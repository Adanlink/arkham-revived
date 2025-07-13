# Continuous Integration and Deployment (CI/CD)

This document explains how to build and publish the container for both AMD64 and ARM64 architectures using GitHub CI/CD.

## GitHub Actions Workflow

The following GitHub Actions workflow will build and publish the container to the GitHub Container Registry.

```yaml
name: Build and Push Docker Image

on:
  push:
    branches:
      - main

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v2

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Log in to the Container registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

### Explanation

- **`on: push: branches: - main`**: This workflow will be triggered every time a commit is pushed to the `main` branch.
- **`jobs: build-and-push: runs-on: ubuntu-latest`**: This defines a job named `build-and-push` that will run on the latest version of Ubuntu.
- **`permissions: contents: read packages: write`**: This gives the workflow the necessary permissions to read the repository contents and write to the GitHub Container Registry.
- **`uses: actions/checkout@v3`**: This action checks out the repository so the workflow can access it.
- **`uses: docker/setup-qemu-action@v2`**: This action sets up QEMU to be able to build images for different architectures.
- **`uses: docker/setup-buildx-action@v2`**: This action sets up Docker Buildx to be able to build multi-platform images.
- **`uses: docker/login-action@v2`**: This action logs in to the GitHub Container Registry.
- **`uses: docker/build-push-action@v4`**: This action builds the Docker image and pushes it to the GitHub Container Registry.
- **`context: .`**: This tells the action to use the current directory as the build context.
- **`platforms: linux/amd64,linux/arm64`**: This tells the action to build the image for both `linux/amd64` and `linux/arm64` platforms.
- **`push: true`**: This tells the action to push the image to the registry.
- **`tags: ghcr.io/${{ github.repository }}:latest`**: This tells the action to tag the image with the name of the repository and the `latest` tag.

## How to use

1. Create a new file named `.github/workflows/docker-publish.yml` in your repository.
2. Copy and paste the workflow code into the file.
3. Commit and push the file to the `main` branch.

Now, every time you push a commit to the `main` branch, the workflow will be triggered and a new Docker image will be built and published to the GitHub Container Registry.
