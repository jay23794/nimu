import { roomService } from '../services/room.service.js';

export const roomController = {
  async create(req, res, next) {
    try {
      const { guestId, nickname } = req.body;
      const result = await roomService.createRoom({ guestId, nickname });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async join(req, res, next) {
    try {
      const { code, guestId, nickname } = req.body;
      const result = await roomService.joinRoom({ code, guestId, nickname });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async random(req, res, next) {
    try {
      const { guestId, nickname } = req.body;
      const result = await roomService.joinOrCreatePublic({ guestId, nickname });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getState(req, res, next) {
    try {
      const state = await roomService.getRoomState(req.params.code);
      res.json(state);
    } catch (err) {
      next(err);
    }
  },

  async getHistory(req, res, next) {
    try {
      const rooms = await roomService.getHistory(req.params.guestId);
      res.json(rooms);
    } catch (err) {
      next(err);
    }
  },
};
