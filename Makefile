# Friendly help message.
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build-frontend   Build the frontend"
	@echo "  run-frontend     Run the frontend in development mode"
	@echo "  run-backend      Run the backend"
	@echo "  compose-up       Start the backend with Docker Compose"
	@echo "  compose-down     Stop the backend with Docker Compose"
	@echo "  help             Show this help message"
	@echo ""


# Build the frontend
build-frontend:
	cd frontend && npm install && npm run build

# Run the frontend in development mode
run-frontend:
	cd frontend && npm run dev

# Run the backend
run-backend: build-frontend
	go mod tidy && go run .

# Run the backend with docker compose
compose-up:
	docker compose up --build

# Tear down the backend with docker compose
compose-down:
	docker compose down
