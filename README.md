# Contract Analysis
Not a lawyer (TM).

This is just a Friday night vibe-coded project I slapped together.
Check out the [screenshots](docs/screenshots) directory to see what it looks like in action.

[Ollama](https://ollama.com) is a required service for this to work.

## The Docker Container
A container with arm64 and amd64 support is maintained on GHCR.

The following command has been tested on MacOS and should work on Linux.
```sh
docker run -p 8080:8080 \
  -e BIND_ADDR=0.0.0.0:8080 \
  -e OLLAMA_MODEL=gpt-oss:20b \
  -e OLLAMA_ENDPOINT=http://host.docker.internal:11434 \
  --name contract-analysis --rm -d ghcr.io/samintheshell/contract-analysis:v0.1
```

Stopping the container will result in cleanup since the previous command used `--rm`.
```
docker stop contract-analysis
```

## Environment Variables

| Variable           | Default                | Description                                                                 |
|--------------------|-----------------------|-----------------------------------------------------------------------------|
| BIND_ADDR          | 127.0.0.1:8080        | Address and port for the backend server to listen on. Set to 0.0.0.0:8080 to listen on all interfaces. |
| DISABLE_FRONTEND   | false                 | If set to true, disables serving the frontend. Accepts 'true' or 'false'.   |
| OLLAMA_MODEL       | gpt-oss:20b           | The model name to use for Ollama requests.                                  |
| OLLAMA_ENDPOINT    | http://localhost:11434| The endpoint URL for the Ollama API.                                        |

Set these variables in your environment to customize server behavior and LLM integration.

## Publishing to GHCR

To build and push a multi-architecture Docker image (arm64 and amd64) to GitHub Container Registry (ghcr.io):

1. **Login to GHCR:**
   ```sh
   echo $GHCR_PAT | docker login ghcr.io -u USERNAME --password-stdin
   ```
   Replace `GHCR_PAT` with your GitHub personal access token and `USERNAME` with your GitHub username.

2. **Create and use a buildx builder:**
   ```sh
   docker buildx create --name multiarch --use
   ```
   ```sh
   docker buildx inspect --bootstrap
   ```

3. **Build and push the image:**
   ```sh
   docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/USERNAME/REPO:TAG --push .
   ```
   Replace `USERNAME`, `REPO`, and `TAG` as appropriate.

   Example:
    ```sh
    docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/samintheshell/contract-analysis:v0.1 --push .
    ```

4. **(Optional) Remove the builder:**
   ```sh
   docker buildx rm multiarch
   ```

This will build and push a multi-architecture image to ghcr.io.

## License
You may only run this privately for testing purposes.
