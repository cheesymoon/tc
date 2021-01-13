import { RegularUser } from '@common/entity/users/RegularUser';
import { Manager } from '@common/entity/users/Manager';
import { AccountManager } from '@common/entity/users/AccountManager';
import { AccountManagerRepository } from '@common/repositories/users/AccountManagerRepository';
import { ManagerRepository } from '@common/repositories/users/ManagerRepository';
import { RegularUserRepository } from '@common/repositories/users/RegularUserRepository';
import { logger } from '@common/services/Logger';
import { ENABLE_TRACKER_FOR_TEST_USERS } from '@config/config';

interface IdIndexable {
  id: number;
}

export enum UserType {
  RegularUser = 'regular_user',
  Manager = 'manager',
  AccountManager = 'account_manager',
}



export interface EventTrackUser {
  id: number,
  firstname: string,
  lastname: string,
  type: UserType,
}

export type ExistingUser =
  | RegularUser & IdIndexable
  | Manager & IdIndexable
  | AccountManager & IdIndexable

export abstract class TrackerDispatcher<TPayload> {
  public async dispatch(
    eventTrackUser: EventTrackUser,
    payload: TPayload,
  ): Promise<void> {
    try {
      const user = await this.getUserFromEventTrackUser(eventTrackUser);

      if (this.preventDispatching(user)) return;

      logger.info(
        `Tracker ${this.constructor.name} called for user ${eventTrackUser.id}`,
      );

      await this.dispatchImpl(user, payload);
    } catch (error) {
      logger.error(
        `TrackerDispatcher Error - error occurred in ${this.constructor.name}`,
      );
      logger.error(error);
    }
  }

  protected abstract dispatchImpl(
    user: ExistingUser,
    payload: TPayload,
  ): Promise<void>

  protected preventDispatchingForNonRegularUser(user: ExistingUser): boolean {
    if (!user.isRegularUser()) {
      logger.info(
        `${this.constructor.name} skipping dispatching for non-RegularUser user ${user.id}`,
      );

      return true
    }

    return false;
  }

  protected preventDispatchingForManageRegularUser(user: ExistingUser): boolean {
    if (user.isRegularUser() && user.isManaged()) {
      logger.info(
        `${this.constructor.name} skipping dispatching for MI user ${user.id}`,
      );

      return true
    }

    return false;
  }

  private async getUserFromEventTrackUser(
    eventTrackUser: EventTrackUser,
  ): Promise<ExistingUser> {
    let user: ExistingUser | undefined;
    if (eventTrackUser.type == UserType.AccountManager) {
      user = await AccountManagerRepository.findById(eventTrackUser.id);
    }
    if (eventTrackUser.type == UserType.Manager) {
      user = await ManagerRepository.findById(eventTrackUser.id);
    }
    if (eventTrackUser.type == UserType.RegularUser) {
      user = await RegularUserRepository.findWithManagers(eventTrackUser.id);
    }

    if (!user) {
      const msg = 'Tracker ' + this.constructor.name + ' - Cannot find user with ' + eventTrackUser.id;

      logger.error(msg);
      throw new Error(msg);
    }

    return user;
  }

  private preventDispatching(user: ExistingUser) {
    if (ENABLE_TRACKER_FOR_TEST_USERS == 'true') {
      logger.warn(
        'Tracker events dispatching is enabled for test users. Remove "ENABLE_Tracker_FOR_TEST_USERS=true" from env vars to disable this warning',
      );

      return false;
    }

    return user.checkIfTestUser();
  }
}
