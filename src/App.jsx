import { EditorProvider } from './context/EditorContext'
import EditorShell from './EditorShell'
import './index.css'

export default function App() {
  return (
    <EditorProvider>
      <EditorShell />
    </EditorProvider>
  )
}
