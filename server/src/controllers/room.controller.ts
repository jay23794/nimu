import { Request, Response, NextFunction } from 'express';
import { roomService } from '../services/room.service.js';

export const roomController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { guestId, nickname, gameMode } = req.body as {
        guestId: string;
        nickname: string;
        gameMode?: 'standard' | 'shared';
      };
      const result = await roomService.createRoom({ guestId, nickname, gameMode });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async join(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, guestId, nickname } = req.body as {
        code: string;
        guestId: string;
        nickname: string;
      };
      const result = await roomService.joinRoom({ code, guestId, nickname });
      console.log(result)
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async random(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { guestId, nickname } = req.body as { guestId: string; nickname: string };
      const result = await roomService.joinOrCreatePublic({ guestId, nickname });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const state = await roomService.getRoomState(req.params.code as string);
      res.json(state);
    } catch (err) {
      next(err);
    }
  },

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rooms = await roomService.getHistory(req.params.guestId as string);
      res.json(rooms);
    } catch (err) {
      next(err);
    }
  },
};
