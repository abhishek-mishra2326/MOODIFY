
# 🎵 MOODIFY — Music for Every Mood

<p align="center">
  <img src="https://img.shields.io/badge/MOODIFY-Music%20Streaming-8A2BE2?style=for-the-badge&logo=musicbrainz&logoColor=white" alt="MOODIFY" />
</p>

<p align="center">
  <strong>Your Music. Your Mood. Your World.</strong>
</p>

<p align="center">
  A modern, interactive and user-friendly music streaming web application.
</p>

<p align="center">
  <a href="https://abhishek-mishra2326.github.io/MOODIFY/">🌐 Live Demo</a> •
  <a href="https://github.com/abhishek-mishra2326/MOODIFY">📂 GitHub Repository</a>
</p>

---

## 🌌 About The Project

**MOODIFY** is a modern music streaming web application created to provide an enjoyable and interactive music listening experience.

It allows users to explore music, discover tracks and enjoy an intuitive music player interface.

Built using React.js and modern web technologies, MOODIFY integrates the Jamendo API for music discovery and Supabase for backend services.

The project also includes Progressive Web App (PWA) support, making it possible to install the application on supported devices.

## ✨ Features

- 🎧 Music discovery using the Jamendo API.
- ▶️ Interactive music player.
- 🔍 Music search and browsing experience.
- ❤️ Personal music library features.
- 🎨 Modern and attractive user interface.
- 📱 Responsive design for different screen sizes.
- ☁️ Supabase backend integration.
- ⚡ Fast frontend powered by React and Vite.
- 📲 Progressive Web App (PWA) support.
- 🤖 Android app packaging using PWABuilder.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| React.js | Frontend development |
| JavaScript | Application functionality |
| Vite | Development and build tool |
| Tailwind CSS | UI styling |
| Lucide React | Icons |
| React Router DOM | Application navigation |
| Supabase | Backend services |
| Jamendo API | Music discovery and track data |
| Git | Version control |
| GitHub | Source code hosting |
| GitHub Actions | Automated deployment |
| PWA | Installable web application |
| PWABuilder | Android app packaging |

## 🌐 Live Demo

Experience MOODIFY here:

**[Open MOODIFY](https://abhishek-mishra2326.github.io/MOODIFY/)**

## 📸 Application Screenshots

Screenshots will be added here.

<!--
Create a screenshots folder in the root directory
and add your application screenshots.

Example:

![MOODIFY Home](screenshots/home.png)
![MOODIFY Player](screenshots/player.png)
-->

## 💻 Installation & Setup

Follow these steps to run the project on your local machine.

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- Git
- Visual Studio Code (recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/abhishek-mishra2326/MOODIFY.git
```

### Step 2: Navigate to the Frontend Folder

```bash
cd MOODIFY/frontend
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment Variables

Create a `.env` file inside the `frontend` folder.

Add the following environment variables:

```env
VITE_JAMENDO_CLIENT_ID=your_jamendo_client_id
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Replace the placeholder values with your own credentials.

**Important:** Never upload your `.env` file, private API secrets or Supabase service-role key to GitHub.

### Step 5: Start the Development Server

```bash
npm run dev
```

Open the local URL displayed in your terminal.

Usually:

```text
http://localhost:5173/
```

## 📲 Progressive Web App (PWA)

MOODIFY supports Progressive Web App functionality.

PWA implementation includes:

- Web App Manifest.
- Custom application icons.
- Service Worker.
- Standalone display mode.
- Basic caching for supported application resources.

The application can also be packaged for Android testing using PWABuilder.

**Note:** Music streaming from external services requires an internet connection. Offline caching does not make all music tracks available offline.

## 🚀 Deployment

MOODIFY is deployed using GitHub Pages and GitHub Actions.

**Live Website:**

https://abhishek-mishra2326.github.io/MOODIFY/

The GitHub Actions workflow automates the deployment process:

1. Checks out the repository.
2. Sets up Node.js.
3. Installs project dependencies.
4. Builds the frontend application.
5. Uploads the production build.
6. Deploys the website to GitHub Pages.

Deployment workflow:

```text
.github/workflows/deploy.yml
```

## 🔐 Environment Variables

The project uses the following environment variables:

| Variable | Description |
|---|---|
| `VITE_JAMENDO_CLIENT_ID` | Jamendo API client ID |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

For production deployment, configure these values in:

**GitHub Repository → Settings → Secrets and variables → Actions**

Never expose private credentials in public source code.

## 🎯 Project Objectives

This project was developed to gain practical experience in:

- React.js application development.
- API integration.
- Backend service integration.
- Interactive UI development.
- Responsive web design.
- Progressive Web App development.
- Git and GitHub workflows.
- Automated website deployment.

## 🔮 Future Improvements

Some planned improvements include:

- Enhanced music recommendation features.
- Improved music discovery and filtering.
- More playlist customization.
- Better offline experience where supported.
- Additional player customization.
- Further performance and UI improvements.

## 👨‍💻 Developer

**Abhishek Mishra**

B.Tech — Computer Science & Engineering (AI/ML)

Aspiring Software Developer | AI/ML Enthusiast

- GitHub: [abhishek-mishra2326](https://github.com/abhishek-mishra2326)
- LinkedIn: [Connect with me](https://www.linkedin.com/)

## 📄 License

This project is developed for educational and personal learning purposes.

Music and third-party content remain subject to their respective owners' licenses and terms of use.

---

<p align="center">
  Made with ❤️ by Abhishek Mishra
</p>

<p align="center">
  <strong>MOODIFY — Your Music. Your Mood. Your World. 🎶</strong>
</p>
