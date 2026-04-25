import './global.css'
import { addRoute, initRouter } from './router.js'

const savedTheme = localStorage.getItem('brew_theme')
if (savedTheme) document.body.dataset.theme = savedTheme

addRoute('/', () => import('./pages/SelectionPage.js'))
addRoute('/recipe/:id', () => import('./pages/RecipeDetailPage.js'))
addRoute('/brew', () => import('./pages/BrewPage.js'))
addRoute('/complete', () => import('./pages/CompletePage.js'))
addRoute('/history', () => import('./pages/HistoryPage.js'))
addRoute('/settings', () => import('./pages/SettingsPage.js'))
addRoute('/admin/rfid', () => import('./pages/RfidAdminPage.js'))

initRouter()
