import type { Request, Response } from 'express';
import { getSessionMiddleware } from '../../middleware';
import { ProfileService } from './profile.service.ts';
import {
  buildRouter,
  Get,
  Post,
  UseMiddleware, Validate,
} from '../../utils/decorators.ts';
import { container, inject, injectable } from 'tsyringe';
import { profileSchema } from './profile.dto.ts';

@injectable()
export class ProfileController {
  constructor(@inject(ProfileService) private readonly profileService: ProfileService) {}

  @Get("/")
  @UseMiddleware(getSessionMiddleware)
  async getProfile(req: Request, res: Response) {
    const userId = req.session.userId;

    const data = await this.profileService.getProfile(userId);

    res.status(200).json({
      email: data?.email,
      currency: data?.preferredCurrency,
      strategy: data?.strategy?.strategy,
      encryptionKey: data?.encryptionKey,
      requiredActions: data?.requiredActions,
    });
  }

  @Post("/")
  @Validate(profileSchema)
  @UseMiddleware(getSessionMiddleware)
  async updateProfile(req: Request, res: Response) {
    const userId = req.session.userId;

    const data = await this.profileService.updateProfile(userId, req.body);

    res.status(201).json({ data });
  }

}

export default buildRouter(container.resolve(ProfileController));
