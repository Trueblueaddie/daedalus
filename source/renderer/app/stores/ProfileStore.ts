import { action, observable, computed, runInAction } from 'mobx';
import BigNumber from 'bignumber.js';
import { includes, camelCase } from 'lodash';
import { toJS } from '../../../common/utils/helper';
import Store from './lib/Store';
import Request from './lib/LocalizedRequest';
import { THEMES } from '../themes/index';
import { ROUTES } from '../routes-config';
import LocalizableError from '../i18n/LocalizableError';
import { WalletSupportRequestLogsCompressError } from '../i18n/errors';
import { generateFileNameWithTimestamp } from '../../../common/utils/files';
import { formattedBytesToSize } from '../utils/formatters';
import { logger } from '../utils/logging';
import { setStateSnapshotLogChannel } from '../ipc/setStateSnapshotLogChannel';
import { getDesktopDirectoryPathChannel } from '../ipc/getDesktopDirectoryPathChannel';
import { getSystemLocaleChannel } from '../ipc/getSystemLocaleChannel';
import { enableApplicationMenuNavigationChannel } from '../ipc/enableApplicationMenuNavigationChannel';
import { LOCALES } from '../../../common/types/locales.types';
import {
  compressLogsChannel,
  downloadLogsChannel,
  getLogsChannel,
} from '../ipc/logs.ipc';
import type { LogFiles, CompressedLogStatus } from '../types/LogTypes';
import type { StateSnapshotLogParams } from '../../../common/types/logging.types';
import type { Locale } from '../../../common/types/locales.types';
import {
  DEFAULT_NUMBER_FORMAT,
  NUMBER_FORMATS,
} from '../../../common/types/number.types';
import {
  hasLoadedRequest,
  isRequestSet,
  requestGetter,
  requestGetterLocale,
  getRequestKeys,
} from '../utils/storesUtils';
import {
  NUMBER_OPTIONS,
  DATE_ENGLISH_OPTIONS,
  DATE_JAPANESE_OPTIONS,
  TIME_OPTIONS,
  PROFILE_SETTINGS,
} from '../config/profileConfig';
import formatCpuInfo from '../utils/formatCpuInfo';
export default class ProfileStore extends Store {
  @observable
  systemLocale: Locale = LOCALES.english;
  @observable
  systemNumberFormat: string = NUMBER_OPTIONS[0].value;
  @observable
  systemDateFormatEnglish: string = DATE_ENGLISH_OPTIONS[0].value;
  @observable
  systemDateFormatJapanese: string = DATE_JAPANESE_OPTIONS[0].value;
  @observable
  systemTimeFormat: string = TIME_OPTIONS[0].value;
  @observable
  getProfileLocaleRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.getUserLocale
  );
  @observable
  setProfileLocaleRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.setUserLocale
  );
  @observable
  getProfileNumberFormatRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.getUserNumberFormat
  );
  @observable
  setProfileNumberFormatRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.setUserNumberFormat
  );
  @observable
  getProfileDateFormatEnglishRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.getUserDateFormatEnglish
  );
  @observable
  setProfileDateFormatEnglishRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.setUserDateFormatEnglish
  );
  @observable
  getProfileDateFormatJapaneseRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.getUserDateFormatJapanese
  );
  @observable
  setProfileDateFormatJapaneseRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.setUserDateFormatJapanese
  );
  @observable
  getProfileTimeFormatRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.getUserTimeFormat
  );
  @observable
  setProfileTimeFormatRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.setUserTimeFormat
  );
  @observable
  getTermsOfUseAcceptanceRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.getTermsOfUseAcceptance
  );
  @observable
  setTermsOfUseAcceptanceRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.setTermsOfUseAcceptance
  );
  @observable
  getAnalyticsAcceptanceRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.getAnalyticsAcceptance
  );
  @observable
  setAnalyticsAcceptanceRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.setAnalyticsAcceptance
  );
  @observable
  getDataLayerMigrationAcceptanceRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.getDataLayerMigrationAcceptance
  );
  @observable
  setDataLayerMigrationAcceptanceRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.setDataLayerMigrationAcceptance
  );
  @observable
  getThemeRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.getUserTheme
  );
  @observable
  setThemeRequest: Request<string> = new Request(
    // @ts-ignore ts-migrate(2339) FIXME: Property 'api' does not exist on type 'ProfileStor... Remove this comment to see the full error message
    this.api.localStorage.setUserTheme
  );
  @observable
  error: LocalizableError | null | undefined = null;
  @observable
  logFiles: LogFiles = {};
  @observable
  compressedLogsFilePath: string | null | undefined = null;
  @observable
  compressedLogsStatus: CompressedLogStatus = {};
  @observable
  desktopDirectoryPath: string = '';
  @observable
  isSubmittingBugReport: boolean = false;
  @observable
  isInitialScreen: boolean = false;

  /* eslint-enable max-len */
  setup() {
    // @ts-ignore ts-migrate(2339) FIXME: Property 'actions' does not exist on type 'Profile... Remove this comment to see the full error message
    const { profile: profileActions } = this.actions;
    profileActions.finishInitialScreenSettings.listen(
      this._finishInitialScreenSettings
    );
    profileActions.updateUserLocalSetting.listen(this._updateUserLocalSetting);
    profileActions.acceptAnalytics.listen(this._acceptAnalytics);
    profileActions.acceptTermsOfUse.listen(this._acceptTermsOfUse);
    profileActions.acceptDataLayerMigration.listen(
      this._acceptDataLayerMigration
    );
    profileActions.updateTheme.listen(this._updateTheme);
    profileActions.getLogs.listen(this._getLogs);
    profileActions.getLogsAndCompress.listen(this._getLogsAndCompress);
    profileActions.downloadLogs.listen(this._downloadLogs);
    profileActions.downloadLogsSuccess.listen(this._toggleDisableDownloadLogs);
    // @ts-ignore ts-migrate(2339) FIXME: Property 'actions' does not exist on type 'Profile... Remove this comment to see the full error message
    this.actions.app.initAppEnvironment.listen(() => {});
    // @ts-ignore ts-migrate(2339) FIXME: Property 'registerReactions' does not exist on typ... Remove this comment to see the full error message
    this.registerReactions([
      this._updateBigNumberFormat,
      this._redirectToInitialSettingsIfNoLocaleSet,
      this._redirectToAnalyticsScreenIfNotAccepted,
      this._redirectToTermsOfUseScreenIfTermsNotAccepted, // this._redirectToDataLayerMigrationScreenIfMigrationHasNotAccepted,
      this._redirectToMainUiAfterTermsAreAccepted,
      this._redirectToMainUiAfterDataLayerMigrationIsAccepted,
    ]);

    this._getTermsOfUseAcceptance();

    this._getAnalyticsAcceptance();

    this._getDataLayerMigrationAcceptance();

    this._getDesktopDirectoryPath();

    this._getSystemLocale();
  }

  _updateBigNumberFormat = () => {
    const FORMAT = {
      ...DEFAULT_NUMBER_FORMAT,
      ...NUMBER_FORMATS[this.currentNumberFormat],
    };
    BigNumber.config({
      FORMAT,
    });
  };

  @computed
  get currentLocale(): Locale {
    return requestGetterLocale(this.getProfileLocaleRequest, this.systemLocale);
  }

  @computed
  get hasLoadedCurrentLocale(): boolean {
    return hasLoadedRequest(this.getProfileLocaleRequest);
  }

  @computed
  get isCurrentLocaleSet(): boolean {
    return isRequestSet(this.getProfileLocaleRequest);
  }

  @computed
  get currentTheme(): string {
    // Default theme handling
    let systemValue;

    if (global.isFlight) {
      systemValue = THEMES.FLIGHT_CANDIDATE;
    } else {
      // @ts-ignore ts-migrate(2339) FIXME: Property 'environment' does not exist on type 'Pro... Remove this comment to see the full error message
      systemValue = this.environment.isMainnet
        ? THEMES.DARK_CARDANO
        : THEMES.LIGHT_BLUE;
    }

    return requestGetter(this.getThemeRequest, systemValue);
  }

  @computed
  get isCurrentThemeSet(): boolean {
    return isRequestSet(this.getThemeRequest);
  }

  @computed
  get hasLoadedCurrentTheme(): boolean {
    return hasLoadedRequest(this.getThemeRequest);
  }

  @computed
  get currentNumberFormat(): string {
    return requestGetter(
      this.getProfileNumberFormatRequest,
      this.systemNumberFormat
    );
  }

  @computed
  get currentDateFormat(): string {
    return this.currentLocale === 'en-US'
      ? this.currentDateEnglishFormat
      : this.currentDateJapaneseFormat;
  }

  @computed
  get currentDateEnglishFormat(): string {
    return requestGetter(
      this.getProfileDateFormatEnglishRequest,
      this.systemDateFormatEnglish
    );
  }

  @computed
  get currentDateJapaneseFormat(): string {
    return requestGetter(
      this.getProfileDateFormatJapaneseRequest,
      this.systemDateFormatJapanese
    );
  }

  @computed
  get currentTimeFormat(): string {
    return requestGetter(
      this.getProfileTimeFormatRequest,
      this.systemTimeFormat
    );
  }

  @computed
  get currentTimeFormatShort(): string {
    return this.currentTimeFormat.replace(':ss', '');
  }

  @computed
  get termsOfUse(): string {
    return require(`../i18n/locales/terms-of-use/${this.currentLocale}.md`);
  }

  @computed
  get hasLoadedTermsOfUseAcceptance(): boolean {
    return (
      this.getTermsOfUseAcceptanceRequest.wasExecuted &&
      this.getTermsOfUseAcceptanceRequest.result !== null
    );
  }

  @computed
  get areTermsOfUseAccepted(): boolean {
    return this.getTermsOfUseAcceptanceRequest.result === true;
  }

  @computed
  get hasLoadedAnalyticsAcceptance(): boolean {
    return (
      this.getAnalyticsAcceptanceRequest.wasExecuted &&
      this.getAnalyticsAcceptanceRequest.result !== null
    );
  }

  @computed
  get areAnalyticsAccepted(): boolean {
    return this.getAnalyticsAcceptanceRequest.result === true;
  }

  @computed
  get hasLoadedDataLayerMigrationAcceptance(): boolean {
    return (
      this.getDataLayerMigrationAcceptanceRequest.wasExecuted &&
      this.getDataLayerMigrationAcceptanceRequest.result !== null
    );
  }

  @computed
  get isDataLayerMigrationAccepted(): boolean {
    return this.getDataLayerMigrationAcceptanceRequest.result === true;
  }

  @computed
  get isProfilePage(): boolean {
    // @ts-ignore ts-migrate(2339) FIXME: Property 'stores' does not exist on type 'ProfileS... Remove this comment to see the full error message
    const { currentRoute } = this.stores.app;
    return includes(ROUTES.PROFILE, currentRoute);
  }

  @computed
  get isSettingsPage(): boolean {
    // @ts-ignore ts-migrate(2339) FIXME: Property 'stores' does not exist on type 'ProfileS... Remove this comment to see the full error message
    const { currentRoute } = this.stores.app;
    return includes(ROUTES.SETTINGS, currentRoute);
  }

  _finishInitialScreenSettings = action(() => {
    this._consolidateUserSettings();

    this.isInitialScreen = false;
  });
  _consolidateUserSettings = () => {
    PROFILE_SETTINGS.forEach((param: string) => {
      this._updateUserLocalSetting({
        param,
      });
    });
  };
  _updateUserLocalSetting = async ({
    param,
    value,
  }: {
    param: string;
    value?: string;
  }) => {
    // In case `value` is missing, it consolidates in the localstorage the default value
    const consolidatedValue =
      // @ts-ignore ts-migrate(2345) FIXME: Argument of type 'string[]' is not assignable to p... Remove this comment to see the full error message
      value || (this as any)[camelCase(['current', param])];
    const { set, get } = getRequestKeys(param, this.currentLocale);
    await (this as any)[set].execute(consolidatedValue);
    await (this as any)[get].execute();

    if (param === 'numberFormat') {
      // Force re-rendering of the sidebar in order to apply new number format
      // @ts-ignore ts-migrate(2339) FIXME: Property 'stores' does not exist on type 'ProfileS... Remove this comment to see the full error message
      this.stores.wallets.refreshWalletsData();
    }
  };
  _updateTheme = async ({ theme }: { theme: string }) => {
    await this.setThemeRequest.execute(theme);
    await this.getThemeRequest.execute();
  };
  _acceptTermsOfUse = async () => {
    await this.setTermsOfUseAcceptanceRequest.execute();
    await this.getTermsOfUseAcceptanceRequest.execute();
    await enableApplicationMenuNavigationChannel.send();
  };
  _getTermsOfUseAcceptance = async () => {
    await this.getTermsOfUseAcceptanceRequest.execute();

    if (this.getTermsOfUseAcceptanceRequest.result) {
      await enableApplicationMenuNavigationChannel.send();
    }
  };
  _acceptAnalytics = async () => {
    await this.setAnalyticsAcceptanceRequest.execute();
    await this.getAnalyticsAcceptanceRequest.execute();
    await enableApplicationMenuNavigationChannel.send();
  };
  _getAnalyticsAcceptance = async () => {
    await this.getAnalyticsAcceptanceRequest.execute();

    if (this.getAnalyticsAcceptanceRequest.result) {
      await enableApplicationMenuNavigationChannel.send();
    }
  };
  _acceptDataLayerMigration = async () => {
    await this.setDataLayerMigrationAcceptanceRequest.execute();
    await this.getDataLayerMigrationAcceptanceRequest.execute();
  };
  _getDataLayerMigrationAcceptance = () => {
    this.getDataLayerMigrationAcceptanceRequest.execute();
  };
  _getDesktopDirectoryPath = async () => {
    this._onReceiveDesktopDirectoryPath(
      await getDesktopDirectoryPathChannel.request()
    );
  };
  _getSystemLocale = async () => {
    this._onReceiveSystemLocale(await getSystemLocaleChannel.request());
  };
  _redirectToInitialSettingsIfNoLocaleSet = () => {
    if (
      (this.hasLoadedCurrentLocale && !this.isCurrentLocaleSet) ||
      this.isInitialScreen
    ) {
      runInAction('Set `isInitialScreen` true', () => {
        this.isInitialScreen = true;
      });
      // @ts-ignore ts-migrate(2339) FIXME: Property 'actions' does not exist on type 'Profile... Remove this comment to see the full error message
      this.actions.router.goToRoute.trigger({
        route: ROUTES.PROFILE.INITIAL_SETTINGS,
      });
    }
  };
  _redirectToTermsOfUseScreenIfTermsNotAccepted = () => {
    const termsOfUseNotAccepted =
      this.hasLoadedTermsOfUseAcceptance && !this.areTermsOfUseAccepted;

    if (
      !this.isInitialScreen &&
      this.isCurrentLocaleSet &&
      this.areAnalyticsAccepted &&
      termsOfUseNotAccepted
    ) {
      // @ts-ignore ts-migrate(2339) FIXME: Property 'actions' does not exist on type 'Profile... Remove this comment to see the full error message
      this.actions.router.goToRoute.trigger({
        route: ROUTES.PROFILE.TERMS_OF_USE,
      });
    }
  };
  _isOnTermsOfUsePage = () =>
    // @ts-ignore ts-migrate(2339) FIXME: Property 'stores' does not exist on type 'ProfileS... Remove this comment to see the full error message
    this.stores.app.currentRoute === ROUTES.PROFILE.TERMS_OF_USE;
  _redirectToAnalyticsScreenIfNotAccepted = () => {
    const analyticsNotAccepted =
      this.hasLoadedAnalyticsAcceptance && !this.areAnalyticsAccepted;

    if (
      !this.isInitialScreen &&
      this.isCurrentLocaleSet &&
      analyticsNotAccepted
    ) {
      // @ts-ignore ts-migrate(2339) FIXME: Property 'actions' does not exist on type 'Profile... Remove this comment to see the full error message
      this.actions.router.goToRoute.trigger({
        route: ROUTES.PROFILE.ANALYTICS,
      });
    }
  };
  _redirectToDataLayerMigrationScreenIfMigrationHasNotAccepted = () => {
    // @ts-ignore ts-migrate(2339) FIXME: Property 'stores' does not exist on type 'ProfileS... Remove this comment to see the full error message
    const { isConnected } = this.stores.networkStatus;
    const dataLayerMigrationNotAccepted =
      this.hasLoadedDataLayerMigrationAcceptance &&
      !this.isDataLayerMigrationAccepted;

    if (
      isConnected &&
      this.isCurrentLocaleSet &&
      this.areTermsOfUseAccepted &&
      this.areAnalyticsAccepted &&
      // @ts-ignore ts-migrate(2339) FIXME: Property 'stores' does not exist on type 'ProfileS... Remove this comment to see the full error message
      this.stores.wallets.hasLoadedWallets &&
      dataLayerMigrationNotAccepted
    ) {
      // @ts-ignore ts-migrate(2339) FIXME: Property 'stores' does not exist on type 'ProfileS... Remove this comment to see the full error message
      if (!this.stores.wallets.hasAnyWallets) {
        // There are no wallets to migrate:
        // set the data layer migration acceptance to true
        // in order to prevent future data migration checks
        this._acceptDataLayerMigration();
      } else {
        // @ts-ignore ts-migrate(2339) FIXME: Property 'actions' does not exist on type 'Profile... Remove this comment to see the full error message
        this.actions.router.goToRoute.trigger({
          route: ROUTES.PROFILE.DATA_LAYER_MIGRATION,
        });
      }
    }
  };
  _redirectToMainUiAfterTermsAreAccepted = () => {
    if (this.areTermsOfUseAccepted && this._isOnTermsOfUsePage()) {
      this._redirectToRoot();
    }
  };
  _redirectToMainUiAfterDataLayerMigrationIsAccepted = () => {
    if (
      this.isDataLayerMigrationAccepted &&
      this._isOnDataLayerMigrationPage()
    ) {
      this._redirectToRoot();
    }
  };
  _isOnDataLayerMigrationPage = () =>
    // @ts-ignore ts-migrate(2339) FIXME: Property 'stores' does not exist on type 'ProfileS... Remove this comment to see the full error message
    this.stores.app.currentRoute === ROUTES.PROFILE.DATA_LAYER_MIGRATION;
  _redirectToRoot = () => {
    // @ts-ignore ts-migrate(2339) FIXME: Property 'actions' does not exist on type 'Profile... Remove this comment to see the full error message
    this.actions.router.goToRoute.trigger({
      route: ROUTES.ROOT,
    });
  };
  _setLogFiles = action((files: LogFiles) => {
    this.logFiles = files;
  });
  _getLogs = async () => {
    const { isDownloading } = this.compressedLogsStatus;
    await this._setStateSnapshotLog();
    const logs = await getLogsChannel.request();

    this._setLogFiles(logs);

    if (isDownloading || this.isSubmittingBugReport) {
      this._compressLogs({
        logs,
      });
    }
  };
  _compressLogs = action(async ({ logs }) => {
    const {
      fileName = generateFileNameWithTimestamp(),
    } = this.compressedLogsStatus;

    try {
      const outputPath = await compressLogsChannel.request({
        logs: toJS(logs),
        compressedFileName: fileName,
      });
      runInAction('ProfileStore::_compressLogs:success', () => {
        this.compressedLogsFilePath = outputPath;
        const { isDownloading, destination } = this.compressedLogsStatus;

        if (isDownloading) {
          // @ts-ignore ts-migrate(2345) FIXME: Argument of type '{ destination: any; fileName: an... Remove this comment to see the full error message
          this._downloadLogs({
            destination,
            fileName,
          });
        }
      });
    } catch (error) {
      runInAction('ProfileStore::_compressLogs:error', () => {
        this.isSubmittingBugReport = false;
        this.error = new WalletSupportRequestLogsCompressError();
      });
    }
  });
  _getLogsAndCompress = action(async () => {
    this.compressedLogsStatus = {
      fileName: generateFileNameWithTimestamp(),
    };
    this.isSubmittingBugReport = true;
    await this._getLogs();
  });
  _downloadLogs = action(async ({ fileName, destination, fresh }) => {
    this.compressedLogsStatus = {
      isDownloading: true,
      destination,
      fileName,
    };

    if (this.compressedLogsFilePath && fresh !== true) {
      // logs already compressed, trigger the download
      try {
        await downloadLogsChannel.request({
          compressedLogsFilePath: this.compressedLogsFilePath,
          destinationPath: destination,
        });
        // @ts-ignore ts-migrate(2339) FIXME: Property 'actions' does not exist on type 'Profile... Remove this comment to see the full error message
        this.actions.profile.downloadLogsSuccess.trigger(false);

        this._reset();
      } catch (error) {
        throw error;
      }
    } else {
      // start process: getLogs -> compressLogs -> downloadLogs (again)
      this._getLogs();
    }
  });
  // Collect all relevant state snapshot params and send them for log file creation
  _setStateSnapshotLog = async () => {
    try {
      logger.info('ProfileStore: Requesting state snapshot log file creation');
      // @ts-ignore ts-migrate(2339) FIXME: Property 'stores' does not exist on type 'ProfileS... Remove this comment to see the full error message
      const { networkStatus } = this.stores;
      const {
        cardanoNodePID,
        cardanoWalletPID,
        tlsConfig,
        stateDirectoryPath,
        diskSpaceAvailable,
        cardanoNodeState,
        isConnected,
        isNodeInSync,
        isNodeResponding,
        isNodeSyncing,
        isSynced,
        syncPercentage,
        localTip,
        networkTip,
      } = networkStatus;
      const {
        build,
        network,
        apiVersion,
        nodeVersion,
        cpu,
        version,
        mainProcessID,
        rendererProcessID,
        isBlankScreenFixActive,
        isDev,
        isMainnet,
        isStaging,
        isTestnet,
        os,
        platformVersion,
        ram,
      // @ts-ignore ts-migrate(2339) FIXME: Property 'environment' does not exist on type 'Pro... Remove this comment to see the full error message
      } = this.environment;
      const systemInfo = {
        platform: os,
        platformVersion,
        cpu: formatCpuInfo(cpu),
        ram: formattedBytesToSize(ram),
        availableDiskSpace: diskSpaceAvailable,
      };
      const coreInfo = {
        daedalusVersion: version,
        daedalusBuildNumber: build,
        daedalusProcessID: rendererProcessID,
        daedalusMainProcessID: mainProcessID,
        isBlankScreenFixActive,
        cardanoNodeVersion: nodeVersion,
        cardanoNodePID,
        cardanoWalletVersion: apiVersion,
        cardanoWalletPID,
        cardanoWalletApiPort: tlsConfig ? tlsConfig.port : 0,
        cardanoNetwork: network,
        daedalusStateDirectoryPath: stateDirectoryPath,
      };
      const stateSnapshotData: StateSnapshotLogParams = {
        systemInfo,
        coreInfo,
        cardanoNodeState,
        currentLocale: this.currentLocale,
        isConnected,
        isDev,
        isMainnet,
        isNodeInSync,
        isNodeResponding,
        isNodeSyncing,
        isStaging,
        isSynced,
        isTestnet,
        currentTime: new Date().toISOString(),
        syncPercentage: syncPercentage.toFixed(2),
        localTip: localTip
          ? {
              epoch: localTip.epoch,
              slot: localTip.slot,
            }
          : localTip,
        networkTip: networkTip
          ? {
              epoch: networkTip.epoch,
              slot: networkTip.slot,
            }
          : networkTip,
      };
      await setStateSnapshotLogChannel.send(stateSnapshotData);
    } catch (error) {
      logger.error('ProfileStore: State snapshot log file creation failed', {
        error,
      });
    }
  };
  _toggleDisableDownloadLogs = action(
    async ({ isDownloadNotificationVisible }) => {
      // @ts-ignore ts-migrate(2339) FIXME: Property 'actions' does not exist on type 'Profile... Remove this comment to see the full error message
      this.actions.app.setIsDownloadingLogs.trigger(
        isDownloadNotificationVisible
      );
    }
  );
  @action
  _onReceiveSystemLocale = (systemLocale: Locale) => {
    this.systemLocale = systemLocale;
  };
  @action
  _onReceiveDesktopDirectoryPath = (desktopDirectoryPath: string) => {
    this.desktopDirectoryPath = desktopDirectoryPath;
  };
  @action
  _reset = () => {
    this.error = null;
    this.compressedLogsFilePath = null;
    this.compressedLogsStatus = {};
    this.isSubmittingBugReport = false;
  };
}