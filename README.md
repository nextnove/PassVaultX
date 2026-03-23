[한국어 버전 (Korean Version)](./README.ko.md)

# PassVaultX

![Wails](https://img.shields.io/badge/Wails-v2-red?style=flat-square&logo=go)
![React](https://img.shields.io/badge/React-v19-blue?style=flat-square&logo=react)
![Go](https://img.shields.io/badge/Go-1.21+-blue?style=flat-square&logo=go)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat-square&logo=tailwind-css)

**PassVaultX** is a secure and easy-to-use desktop password manager built on the Wails framework. It provides powerful security features and an intuitive UI to safely protect your valuable account information.

## ✨ Key Features

- **🔐 Security Vault**: Encrypts and protects account info using a Master Password. Supports PBKDF2 algorithm and provides an auto-lock feature after a period of inactivity.
- **📋 Account Management**: Add, edit, delete, and categorize account information.
- **🎲 Password Generator**: Generates strong, secure passwords based on user-defined options (length, letters, numbers, special characters, etc.).
- **📱 Clipboard Auto-Clear**: Automatically deletes clipboard contents after a set time to enhance security after copying a password.
- **📂 Backup & Recovery**: Create or import encrypted backup files (.enc) to manage account information securely.
- **📊 Export to Excel**: Easily export the stored account list to an Excel file (.xlsx).
- **🌐 Multi-language Support**: Supports both English and Korean, easily changeable in settings.
- **🎨 Theme Support**: Supports automatic themes based on system settings, as well as Dark/Light modes.

## 🛠 Tech Stack

- **Backend**: [Go](https://go.dev/) (Wails v2)
- **Frontend**: [React v19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Internationalization**: [i18next](https://www.i18next.com/)

## 🚀 Getting Started

### Prerequisites

- [Go](https://go.dev/dl/) 1.21+
- [Node.js](https://nodejs.org/) 18+ and npm
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) installed:
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

### Run in Dev Mode

Run the following command in the project root directory:
```bash
wails dev
```

### Build & Create Executable

To create an executable (.exe) for Windows, run:
```bash
wails build
```
The built file can be found in the `build/bin` directory.

## 📸 Screenshots

*(Please add application screenshots here)*

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---
**Author**: [nextnove](mailto:nextnove.com@gmail.com)
