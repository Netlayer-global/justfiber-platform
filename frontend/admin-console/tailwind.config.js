/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "#07101b",
        foreground: "#ecf4ff",
        muted: "#96a4bb",
        panel: "#0f1725",
        border: "rgba(148, 163, 184, 0.16)",
        brand: {
          1: "#7c3aed",
          2: "#38bdf8",
          3: "#fb7185",
          4: "#22c55e"
        }
      },
      boxShadow: {
        panel: "0 24px 60px rgba(2, 6, 23, 0.45)"
      },
      borderRadius: {
        xl2: "1.5rem"
      },
      backgroundImage: {
        mesh:
          "radial-gradient(circle at top left, rgba(124, 58, 237, 0.22), transparent 28%), radial-gradient(circle at top right, rgba(56, 189, 248, 0.16), transparent 22%), radial-gradient(circle at bottom right, rgba(251, 113, 133, 0.12), transparent 22%), linear-gradient(135deg, #08111c 0%, #0a1322 50%, #09111a 100%)"
      }
    }
  },
  plugins: []
};
