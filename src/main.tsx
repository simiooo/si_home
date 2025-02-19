
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import DragContextProvider from "./components/DragAndDrop/DragContextProvider.tsx";

createRoot(document.getElementById("root")!).render(

    <DragContextProvider>
      <App />
    </DragContextProvider>

);
