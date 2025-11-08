import HomePage from '../pages/home/home-page';
import AddStoryPage from '../pages/about/add-story-page'; // ← Update import
import MapPage from '../pages/map/map-page';
import DetailPage from '../pages/detail/detail-page';
import AuthPage from '../pages/auth/auth-page';

const routes = {
  '/': new HomePage(),
  '/auth': new AuthPage(),
  '/add-story': new AddStoryPage(),  // ← Route baru
  '/add-review': new AddStoryPage(), // ← Alias untuk backward compatibility
  '/map': new MapPage(),
  '/detail/:id': new DetailPage(),
};

export default routes;