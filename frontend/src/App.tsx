import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import {
  Home,
  MyServers,
  AddServer,
  Stream,
  Alerts,
  Debug,
  Edit,
} from './routes';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/servers" element={<MyServers />} />
          <Route path="/servers/new" element={<AddServer />} />
          <Route path="/servers/:serverId/stream" element={<Stream />} />
          <Route path="/servers/:serverId/alerts" element={<Alerts />} />
          <Route path="/servers/:serverId/debug" element={<Debug />} />
          <Route path="/servers/:serverId/edit" element={<Edit />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;

