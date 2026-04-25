import { get, post, del } from './client.js';

export const getSession       = ()       => get('/session/');
export const getCurrentStep   = ()       => get('/recipe/current/');
export const getCurrentWeight = ()       => get('/weight/current/');
export const getRecipes       = ()       => get('/recipes/');
export const getRecipe        = (id)     => get(`/recipes/${id}`);
export const selectRecipe     = (uid)    => post('/recipe/select/', { uid });
export const completeStep     = (weight) => post('/step/complete/', { weight });
export const completeBrew     = ()       => post('/brew/complete/', {});
export const getHistory       = ()       => get('/brews/history/');
export const getOled          = ()       => get('/oled/');
export const postWeight       = (weight) => post('/weight/current/', { weight });
export const postConfirmedWeight = (weight) => post('/weight/confirmed/', { weight });
export const clearHistory        = ()       => del('/brews/history/');
export const getRfidMappings     = ()             => get('/rfid-mappings/');
export const addRfidMapping      = (uid, recipe_id) => post('/rfid-mappings/', { uid, recipe_id });
export const deleteRfidMapping   = (uid)          => del(`/rfid-mappings/${encodeURIComponent(uid)}/`);
export const getLastRfid         = ()             => get('/rfid/last/');
