package frontend

import (
	"bytes"
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

//go:embed dist/**
var dist embed.FS

// TODO: Needs documentation
var Content = func() fs.FS {
	subFS, err := fs.Sub(dist, "dist")
	if err != nil {
		log.Fatalf("Failed to create sub file system (static): %v", err)
	}

	// list all files in views.EmbeddedFS
	err = fs.WalkDir(subFS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			Manifest = append(Manifest, path)
		}
		return nil
	})

	if err != nil {
		log.Fatalf("failed to walk embedded filesystem: %v", err)
	}

	return subFS
}()

var Manifest = []string{}

func serveIndexHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	file, err := Content.Open("index.html")
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		log.Printf("Error getting file stat for index.html: %v", err)
		http.Error(w, "Failed to get file info", http.StatusInternalServerError)
		return
	}

	content, err := io.ReadAll(file)
	if err != nil {
		log.Printf("Error reading file content for index.html: %v", err)
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}
	http.ServeContent(w, r, "index.html", stat.ModTime(), bytes.NewReader(content))
}

// Updates the 404 handler to serve the index.html.
// This must be set after all other routes.
// If this is done before any routes are registered, the 404 handler will be called unexectedly.
func AddRoute404(r *mux.Router) *mux.Router {
	r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound) // Set 404 status in the headers
		serveIndexHandler(w, r)
	})
	return r
}

// Adds frontend routes to the router.
func AddRoutes(r *mux.Router) (*mux.Router, error) {
	// Server production ready UI paths
	// When a new route is added to App.tsx, it should be added here as well
	r.HandleFunc("/", serveIndexHandler).Methods("GET")

	// list all files in views.EmbeddedFS
	err := fs.WalkDir(Content, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			// Ignore index.html, it is configured to be served by multiple routes
			if path == "index.html" {
				return nil
			}

			log.Printf("Serving %s", "/"+path)

			r.HandleFunc("/"+path, func(w http.ResponseWriter, r *http.Request) {
				file, err := Content.Open(path)
				if err != nil {
					log.Printf("Error opening file %s: %v", path, err)
					http.Error(w, "File not found", http.StatusNotFound)
					return
				}
				defer file.Close()

				stat, err := file.Stat()
				if err != nil {
					log.Printf("Error getting file stat for %s: %v", path, err)
					http.Error(w, "Failed to get file info", http.StatusInternalServerError)
					return
				}

				content, err := io.ReadAll(file)
				if err != nil {
					log.Printf("Error reading file content for %s: %v", path, err)
					http.Error(w, "Failed to read file", http.StatusInternalServerError)
					return
				}
				http.ServeContent(w, r, path, stat.ModTime(), bytes.NewReader(content))
			})
		}
		return nil
	})

	if err != nil {
		log.Fatalf("failed to walk embedded filesystem: %v", err)
	}

	return r, err
}
