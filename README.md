# GASH Dashboard

This project has been migrated from Create React App to Vite + Tailwind CSS for better performance and development experience.

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.\
Open [http://localhost:5173](http://localhost:5173) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `dist` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

### `npm run preview`

Preview the production build locally.

### `npm run lint`

Run ESLint to check for code quality issues.

## Tech Stack

- **React 19.1.0** - UI library
- **Vite 7.0.4** - Build tool and dev server
- **Tailwind CSS 4.1.13** - Utility-first CSS framework
- **React Router DOM 7.6.1** - Client-side routing
- **Chart.js & React-ChartJS-2** - Data visualization
- **Socket.io Client** - Real-time communication
- **Axios** - HTTP client

## Project Structure

```
src/
├── components/          # React components
├── context/            # React context providers
├── assets/             # Static assets (images, fonts)
├── styles/             # CSS files
├── App.js              # Main App component
├── main.jsx            # Entry point
└── index.css           # Global styles with Tailwind
```

## Migration Notes

This project was migrated from Create React App to Vite + Tailwind CSS. The main changes include:

- Entry point changed from `src/index.js` to `src/main.jsx`
- HTML template moved from `public/index.html` to root `index.html`
- Added Vite configuration (`vite.config.js`)
- Added Tailwind CSS configuration (`tailwind.config.js`)
- Updated build scripts and dependencies
- Added ESLint configuration for better code quality

All existing React components and functionality remain unchanged.
