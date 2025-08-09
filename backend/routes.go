package backend

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

const failedToEncodeResponse = `{"status": "FAILURE", "message": "Failed to encode response.", "data": {}}`

func AddRoutes(r *mux.Router) (*mux.Router, error) {
	r.HandleFunc("/api/v1/todo", todoHandler).Methods("GET")
	r.HandleFunc("/api/v1/doc-analysis", DocAnalysisWS).Methods("GET")
	return r, nil
}

func todoHandler(w http.ResponseWriter, r *http.Request) {
	write(w, http.StatusOK,
		struct {
			Status  string      `json:"status"`
			Message string      `json:"message"`
			Data    interface{} `json:"data"`
		}{
			Status:  "SUCCESS",
			Message: "This is a placeholder handler.",
			Data: map[string]interface{}{
				"current_time_utc": time.Now().UTC().Format(time.RFC3339),
			},
		},
	)
}

func write(w http.ResponseWriter, status int, msg interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(msg); err != nil {
		http.Error(w, failedToEncodeResponse, http.StatusInternalServerError)
	}
}
