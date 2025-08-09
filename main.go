package main

import (
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/samintheshell/contract-analysis/backend"
	"github.com/samintheshell/contract-analysis/frontend"
)

var BIND_ADDR = func() string {
	if addr := os.Getenv("BIND_ADDR"); addr != "" {
		return addr
	}
	return "127.0.0.1:8080"
}()

var DISABLE_FRONTEND = func() bool {
	value := os.Getenv("DISABLE_FRONTEND")
	if value != "" {
		if v, err := strconv.ParseBool(value); err == nil {
			return v
		}
	}
	return false
}()

func main() {
	r := mux.NewRouter().StrictSlash(true)
	if _, err := backend.AddRoutes(r); err != nil {
		log.Fatalf("Failed to add routes: %v", err)
	}

	if !DISABLE_FRONTEND {
		if _, err := frontend.AddRoutes(r); err != nil {
			log.Fatalf("Failed to add frontend routes: %v", err)
		}
	}

	log.Printf("Starting server on %s", BIND_ADDR)
	log.Fatal(http.ListenAndServe(BIND_ADDR, r))
}
