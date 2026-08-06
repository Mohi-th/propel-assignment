import { Provider } from "react-redux";
import store from "./redux/store.js";
import Dashboard from "./pages/Dashboard.jsx";
import "./styles/index.css";

function App() {
  return (
    <Provider store={store}>
      <Dashboard />
    </Provider>
  );
}

export default App;
