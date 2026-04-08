import { Router } from 'express';
import { roomController } from '../controllers/room.controller.js';

export const roomRouter = Router();

roomRouter.post('/create', roomController.create);
roomRouter.post('/join', roomController.join);
roomRouter.post('/random', roomController.random);
roomRouter.get('/history/:guestId', roomController.getHistory);
roomRouter.get('/:code', roomController.getState);
