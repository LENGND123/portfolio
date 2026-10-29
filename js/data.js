const LANG_COLOR = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  CSS: '#563d7c',
  HTML: '#e34c26',
}

export const FALLBACK_USER = {
  login: 'LENGND123',
  name: 'Aditya Raj Singh',
  bio: 'B.Tech CSE student. AI, ML, and full-stack work in Python, TypeScript, React, and JavaScript.',
  location: 'Ajmer, Rajasthan, India',
  company: 'Student Developer',
  avatar: 'https://avatars.githubusercontent.com/u/158607623?v=4',
  followers: 23,
  following: 23,
  public_repos: 41,
  html_url: 'https://github.com/LENGND123',
  blog: 'https://www.linkedin.com/in/aditya-raj-singh',
  email: 'sadityaraj369@gmail.com',
  portfolio: 'https://lengnd123.github.io/portfolio/',
}

export const FALLBACK_PROJECTS = [
  {
    repo: 'Mori',
    description: 'A gentle daily companion for tasks, focus sessions, and private reflections.',
    language: 'JavaScript',
    stack: 'HTML  ·  CSS  ·  JAVASCRIPT',
    url: 'https://adityarajsingh.co.in/mori/',
  },
  {
    repo: 'Stock-Prediction-Dashboard',
    description: 'Yahoo Finance dashboard with linear regression and random forest forecasts for the next close.',
    language: 'Python',
    stack: 'PYTHON  ·  FLASK',
    url: 'https://stock-prediction-dashboard-omega.vercel.app/',
    image: 'assets/previews/stock-prediction-dashboard.png',
  },
  {
    repo: 'uber-clone',
    description: 'Ride-hailing demo with a rider, a captain, a live map, an OTP, and cash fare.',
    language: 'JavaScript',
    stack: 'JAVASCRIPT  ·  REACT  ·  NODE',
    url: 'https://uber-clone-xi-jade.vercel.app',
    image: 'assets/previews/uber-clone.png',
  },
  {
    repo: 'job-portal',
    description: 'Students search and apply. Recruiters post jobs and review applicants.',
    language: 'JavaScript',
    stack: 'JAVASCRIPT  ·  MERN',
    url: 'https://job-portal-pied-omega.vercel.app/',
    image: 'assets/previews/job-portal.png',
  },
  {
    repo: 'ai-interview-prep',
    description: 'MERN interview practice with JWT auth, Gemini question generation and scoring, and saved history.',
    language: 'JavaScript',
    stack: 'JAVASCRIPT  ·  MERN',
    url: 'https://github.com/LENGND123/ai-interview-prep',
    image: 'assets/previews/ai-interview-prep.png',
  },
  {
    repo: 'steering-wheel',
    description: 'Virtual steering wheel using Python, OpenCV, and MediaPipe hand tracking.',
    language: 'Python',
    stack: 'PYTHON  ·  OPENCV',
    url: 'https://github.com/LENGND123/steering-wheel',
    image: 'assets/previews/steering-wheel.png',
  },
  {
    repo: 'clearpath',
    description: 'On-call agent whose decisions come from FalkorDB.',
    language: 'Python',
    stack: 'PYTHON  ·  FALKORDB',
    url: 'https://github.com/LENGND123/clearpath',
    image: 'assets/previews/clearpath.png',
  },
  {
    repo: 'nova-ui',
    description: 'Calm mobile workspace: schedule, library, insights, messages, and profile.',
    language: 'TypeScript',
    stack: 'TYPESCRIPT',
    url: 'https://github.com/LENGND123/nova-ui',
    image: 'assets/previews/nova-ui.png',
  },
  {
    repo: 'meridian',
    description: 'A local Windows system instrument.',
    language: 'CSS',
    stack: 'CSS  ·  WINDOWS',
    url: 'https://lengnd123.github.io/meridian/',
    image: 'assets/previews/meridian.png',
  },
  {
    repo: 'school-aqi-alert',
    description: 'Texts a school principal at 6:30 AM when the air is bad.',
    language: 'Python',
    stack: 'PYTHON',
    url: 'https://school-aqi-alert.vercel.app/',
    image: 'assets/previews/school-aqi-alert.png',
  },
]

export const LAYOUT = {
  spawn: { x: 0, z: 8, yaw: 0 },
  profile: { x: -14.5, z: -16 },
  playground: { x: 18, z: -18 },
  projectZ: (index) => -34 - index * 13,
}

export async function loadContent() {
  const user = { ...FALLBACK_USER }
  const projects = FALLBACK_PROJECTS.map((project) => ({
    ...project,
    stars: 0,
    color: LANG_COLOR[project.language] || '#c9d1d9',
  }))

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    const [userRes, repoRes] = await Promise.all([
      fetch('https://api.github.com/users/LENGND123', { signal: ctrl.signal }),
      fetch('https://api.github.com/users/LENGND123/repos?per_page=100&sort=pushed', { signal: ctrl.signal }),
    ])
    if (userRes.ok) {
      const live = await userRes.json()
      user.login = live.login || user.login
      user.name = live.name || user.name
      user.bio = live.bio || user.bio
      user.location = live.location || user.location
      user.company = live.company || user.company
      user.avatar = live.avatar_url || user.avatar
      user.followers = live.followers ?? user.followers
      user.following = live.following ?? user.following
      user.public_repos = live.public_repos ?? user.public_repos
      user.html_url = live.html_url || user.html_url
      if (live.blog) user.blog = live.blog.startsWith('http') ? live.blog : `https://${live.blog}`
    }
    if (repoRes.ok) {
      const repos = await repoRes.json()
      if (Array.isArray(repos)) {
        const byName = new Map(repos.map((repo) => [repo.name.toLowerCase(), repo]))
        for (const project of projects) {
          const repo = byName.get(project.repo.toLowerCase())
          if (!repo) continue
          if (repo.description) project.description = repo.description
          if (repo.language) {
            project.language = repo.language
            project.color = LANG_COLOR[repo.language] || '#c9d1d9'
          }
          project.stars = repo.stargazers_count || 0
          project.repoUrl = repo.html_url
          if (repo.homepage && String(repo.homepage).startsWith('http')) project.url = repo.homepage
        }
      }
    }
  } catch {
    user.offline = true
  } finally {
    clearTimeout(timer)
  }

  return { user, projects }
}
