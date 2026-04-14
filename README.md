# OneFileFinance

OneFileFinance is a fast, local-first personal finance management application. It helps you track transactions, manage multiple accounts, categorize expenses, and visualize your financial health—all while keeping your data secure on your own device.

## Features

*   **Local-First Architecture:** All financial data is stored locally in your browser using IndexedDB (via Dexie.js) for maximum privacy and speed.
*   **Transaction Management:** Easily add, edit, and search transactions.
*   **Batch Operations:** Select multiple transactions to quickly delete, recategorize, or move them between accounts.
*   **Smart Categorization:** Create custom categories and set up auto-categorization rules to automatically sort imported transactions.
*   **Interactive Reporting:** Visualize your net worth, account distribution, and asset allocation with dynamic charts.
*   **CSV Import & Export:** Seamlessly bring in data from your bank or export it for backup.
*   **Cross-Platform Desktop App:** Built with Tauri, allowing you to compile the app into a lightweight, native desktop executable for Windows, macOS, and Linux.

## Demo

You can run the web version of OneFileFinance directly in your browser. Since it uses local storage, no backend setup or database provisioning is required to get started. Just run the development server (see below) and open `http://localhost:3000`.

## Release (How to Build)

OneFileFinance can be run as a standard web application or compiled into a native desktop app using Tauri.

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or newer)
*   [Rust](https://www.rust-lang.org/tools/install) (required for building the desktop app)
*   [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) (C++ build tools for Windows, etc.)

### Web Application

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

### Desktop Application (Tauri)

To build the standalone desktop executable (e.g., `.exe` for Windows):

1. Ensure all prerequisites (Node.js, Rust, build tools) are installed on your system.
2. Install project dependencies:
   ```bash
   npm install
   ```
3. (Optional) Generate application icons from the source SVG:
   ```bash
   npx tauri icon public/favicon.svg
   ```
4. Build the Tauri app:
   ```bash
   npm run tauri build
   ```
The compiled executable will be located in the `src-tauri/target/release/bundle/` directory.
