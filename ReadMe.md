# Minecraft Modpack Manager

Minecraft Modpack Manager is a user-friendly desktop application built with Electron. It allows players to manage and
update Minecraft modpacks easily by integrating with a Git repository. The app is designed to simplify the process of
loading and updating mods and resource packs, making it accessible even for users without coding or Git experience.

## Features

- Mod Folder Management: Select your Minecraft folder and manage modpacks effortlessly.
- Branch-based Modpacks: Switch between different modpacks stored as branches in a Git repository.
- Automatic Updates: Pull the latest updates for the selected modpack with a single click.
- File Tracking: Displays the count of .jar files in the mods folder and .zip files in the resourcepacks folder.
- Dark Mode UI: Enjoy a sleek, modern interface designed for dark mode.
- Custom Title Bar: Includes custom minimize, maximize, and close buttons.

## Installation

Either download the `.exe` File from the Release Tab or

1. Clone this repository:

```bash
git clone https://github.com/xSentry/mc-modpack-manager
```

2. Navigate to the project directory:

```bash
cd mc-modpack-manager
```

3. Install dependencies:

```bash
npm install
```

4. Start the application:

```bash
npm start
```

## Usage

1. Select Minecraft Folder:

- Use the "Select Minecraft Folder" button to choose your .minecraft directory.

2. Choose a Modpack:

- Select a branch (modpack) from the dropdown menu.

3. Initialize or Update Modpack:

- Click the Initialize Manager button to clone the repository if it hasn’t been cloned.
- Click the Update Modpack button to pull the latest changes for the selected modpack.

4. Track Mod and Resource Pack Counts:

- The app displays the number of .jar files in the mods folder and .zip files in the resourcepacks folder.

Screenshots

## Contributing

1. Fork the repository.
2. Create a new branch:

```bash
git checkout -b feature-name
```

3. Make your changes and commit:

```bash
git commit -m "Add feature-name"
```

4. Push your branch:

```bash
git push origin feature-name
```

5. Open a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.