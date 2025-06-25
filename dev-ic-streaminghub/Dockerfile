FROM mcr.microsoft.com/devcontainers/base:jammy

# Set environment variables for non-interactive installations
ENV DEBIAN_FRONTEND=noninteractive
# ENV DFXVM_INIT_YES=true

# Set the working directory for the application
# We'll put our source code here later.
WORKDIR /src

# --- System Dependencies ---
# Install essential build tools and libraries first.
# Grouping apt-get commands improves efficiency by reducing image layers.
RUN apt-get update -y && \
    apt-get install -y \
    curl \
    git \
    build-essential \
    libxtables12 \
    ffmpeg \
    expect && \
    rm -rf /var/lib/apt/lists/*


ARG USER_NAME=icuser
ARG USER_UID=1001
ARG USER_GID=$USER_UID

RUN apt-get update -y && apt-get install -y sudo && \
    if ! getent group $USER_GID; then groupadd --gid $USER_GID $USER_NAME; fi && \
    if ! id -u $USER_UID >/dev/null 2>&1; then useradd -s /bin/bash --uid $USER_UID --gid $USER_GID -m $USER_NAME; fi && \
    usermod -aG sudo $USER_NAME && \
    echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USER_NAME && \
    chmod 0440 /etc/sudoers.d/$USER_NAME && \
    mkdir -p /src && \
    chown -R $USER_NAME:$USER_GID /src

USER $USER_NAME:$USER_GID

# RUN groupadd --gid $USER_GID $USER_NAME && \
#     useradd -s /bin/bash --uid $USER_UID --gid $USER_GID -m $USER_NAME && \
#     # usermod -aG sudo $USER_NAME && \
#     # echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USER_NAME && \
#     # chmod 0440 /etc/sudoers.d/$USER_NAME && \
#     chmod -R $USER_NAME:$USER_GID /src


# USER $USER_NAME:$USER_GID



# # --- Node.js (NVM) Installation ---
# # Install NVM and then Node.js LTS, Yarn, and specific npm versions.
# # We run these commands in a single RUN layer to ensure environment sourcing
# # persists for subsequent Node.js-related commands.
# RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && \
#     . "$HOME/.nvm/nvm.sh" && \
#     nvm install --lts && \
#     nvm use --lts && \
#     node -v && npm -v && \
#     npm i -g yarn && \
#     npm install -g npm@11.4.2 && \
#     nvm use --lts && \
#     npm install -g typescript react

# --- DFX (Internet Computer SDK) Installation ---
# Install the DFX SDK. We let it install the latest stable version by default.
# We've already set DFXVM_INIT_YES=true at the top.
# RUN sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)" && \
#     # The installer places `dfx` in $HOME/.local/share/dfx/bin.
#     # Ensure it's in PATH for subsequent commands in the same RUN layer.
#     # This will source the env, making dfx command available.
#     bash -c 'source "$HOME/.local/share/dfx/env" && dfx --version'

# --- Rust Installation ---
# Install Rust using rustup and add the wasm32-unknown-unknown target.
# Source the cargo env to make cargo commands available.
# RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable && \
#     # Source cargo environment for the current RUN command
#     . "$HOME/.cargo/env" && \
#     cargo --version && \
#     rustup target add wasm32-unknown-unknown

# --- PocketIC (Optional, uncomment if needed) ---
# If you need PocketIC for local testing, uncomment and include these steps.
# RUN curl -OL https://github.com/dfinity/pocketic/releases/download/7.0.0/pocket-ic-x86_64-linux.gz && \
#     gzip -d pocket-ic-x86_64-linux.gz && \
#     chmod +x pocket-ic-x86_64-linux && \
#     mv pocket-ic-x86_64-linux pocket-ic && \
#     export POCKET_IC_BIN="$(pwd)/pocket-ic"

# --- Bats (Optional, uncomment if needed) ---
# If you need Bats for testing, uncomment and include these steps.
# RUN git clone https://github.com/sstephenson/bats.git /usr/local/src/bats && \
#     /usr/local/src/bats/install.sh /usr/local

# --- Final Step: Copy Application Code and Set Entrypoint ---
# This assumes your Dockerfile is in the root of your project
# and the actual application code is in a subdirectory like 'streamingservice'.
# If your project structure is different, adjust the COPY command accordingly.
# COPY . /src/

# Set the default command to execute when the container starts.
# This assumes your primary work is in the 'streamingservice' directory.
# `bash` allows for interactive debugging within the container if needed.
# Consider changing this to a specific build or run command if you have one.
# CMD ["bash", "/src/streamingservice/exec_script.sh"]
# Assuming you have an exec_script.sh here

# You might want to define an ENTRYPOINT for running your application consistently
# ENTRYPOINT ["dfx", "start", "--background"]


# FROM mcr.microsoft.com/devcontainers/base:jammy

# # Set environment variables for non-interactive installations
# ENV DEBIAN_FRONTEND=noninteractive
# ENV DFXVM_INIT_YES=true
# # For DFX installer

# # --- Add 'vscode' user and switch to it before installing DFX and Rust ---
# # This is crucial for Dev Containers as they often run as 'vscode' user.
# # Check if 'vscode' user already exists from base image/devcontainer setup.
# ARG USERNAME=vscode
# ARG USER_UID=1000
# ARG USER_GID=$USER_UID

# RUN if ! id -u $USERNAME > /dev/null 2>&1; then \
#     groupadd --gid $USER_GID $USERNAME && \
#     useradd -s /bin/bash --uid $USER_UID --gid $USER_GID -m $USERNAME; \
#     fi && \
#     apt-get install -y sudo && \
#     echo $USERNAME ALL=\(ALL\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME && \
#     chmod 0440 /etc/sudoers.d/$USERNAME

# # Switch to the vscode user for DFX and Rust installation
# USER $USERNAME

# # --- System Dependencies (Repeat apt-get here if running as non-root user) ---
# # Alternatively, keep all apt-get as root at the beginning.
# # If you run apt-get as non-root, you'll need sudo.
# # For simplicity, keep all apt-get commands as root at the very beginning.

# # Re-setting WORKDIR for the vscode user's home or a shared location
# WORKDIR /home/$USERNAME/src
# # Or /src if you prefer a shared location accessible by vscode user

# # --- Node.js (NVM) Installation ---
# # NVM will install to /home/vscode/.nvm
# RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && \
#     . "$HOME/.nvm/nvm.sh" && \
#     nvm install --lts && \
#     nvm use --lts && \
#     node -v && npm -v && \
#     npm i -g yarn && \
#     npm install -g npm@11.4.2 && \
#     nvm use --lts && \
#     npm install -g typescript react

# # --- DFX (Internet Computer SDK) Installation ---
# # DFX will install to /home/vscode/.local/share/dfx
# RUN sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)" && \
#     . "$HOME/.local/share/dfx/env" && \
#     dfx --version

# # --- Rust Installation ---
# # Rust will install to /home/vscode/.cargo
# RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable && \
#     . "$HOME/.cargo/env" && \
#     cargo --version && \
#     rustup target add wasm32-unknown-unknown

# # --- Final Step: Copy Application Code and Set Entrypoint ---
# # COPY command runs as the user specified by `USER` instruction, or root if not specified.
# # Ensure /src exists and is accessible for the user.
# # If WORKDIR is /home/vscode/src, then copy to there.
# COPY . /home/$USERNAME/src/
