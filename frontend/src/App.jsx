import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app-container">
      <header>
        <h1 className="hero-title">Mount Vernon Trail</h1>
        <p className="hero-subtitle">
          Experience the beauty of the Potomac River. Track your journey, discover landmarks, and join the community.
        </p>
        <button className="btn" onClick={() => setCount((count) => count + 1)}>
          Join {count} others
        </button>
      </header>
    </div>
  )
}

export default App
