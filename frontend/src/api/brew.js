import { get, post } from './client.js';

export const getSession = () => get('/api/session');
export const getCurrentWeight = () => get('/api/weight');
export const getRecipes = () => get('/api/recipes');
export const getRecipe = (id) => get(`/api/recipes/${id}`);
export const selectRecipe = (rfid) => post('/api/recipe/select', { rfid });
export const completeStep = () => post('/api/brew/step', {});
export const completeBrew = () => post('/api/brew/complete', {});
export const getHistory = () => get('/api/history');
export const getOled = () => get('/api/oled');
export const postWeight = (weight) => post('/api/weight', { weight });
export const postConfirmedWeight = (weight) => post('/api/weight/confirm', { weight });
