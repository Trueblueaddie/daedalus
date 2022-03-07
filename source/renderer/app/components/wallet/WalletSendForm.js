// @flow
import React, { Component, Fragment } from 'react';
import type { Node } from 'react';
import type { Field } from 'mobx-react-form';
import { observer } from 'mobx-react';
import { intlShape, FormattedHTMLMessage } from 'react-intl';
import { filter, get, indexOf, omit, map, without } from 'lodash';
import BigNumber from 'bignumber.js';
import classNames from 'classnames';
import SVGInline from 'react-svg-inline';
import vjf from 'mobx-react-form/lib/validators/VJF';
import { Button } from 'react-polymorph/lib/components/Button';
import { Input } from 'react-polymorph/lib/components/Input';
import { NumericInput } from 'react-polymorph/lib/components/NumericInput';
import { PopOver } from 'react-polymorph/lib/components/PopOver';
import BorderedBox from '../widgets/BorderedBox';
import LoadingSpinner from '../widgets/LoadingSpinner';
import ReadOnlyInput from '../widgets/forms/ReadOnlyInput';
import { FormattedHTMLMessageWithLink } from '../widgets/FormattedHTMLMessageWithLink';
import questionMarkIcon from '../../assets/images/question-mark.inline.svg';
import globalMessages from '../../i18n/global-messages';
import messages from './send-form/messages';
import { messages as apiErrorMessages } from '../../api/errors';
import ReactToolboxMobxForm from '../../utils/ReactToolboxMobxForm';
import {
  formattedAmountToNaturalUnits,
  formattedAmountToLovelace,
} from '../../utils/formatters';
import { FORM_VALIDATION_DEBOUNCE_WAIT } from '../../config/timingConfig';
import { TRANSACTION_MIN_ADA_VALUE } from '../../config/walletsConfig';
import { NUMBER_FORMATS } from '../../../../common/types/number.types';
import AssetInput from './send-form/AssetInput';
import WalletSendAssetsConfirmationDialog from './send-form/WalletSendAssetsConfirmationDialog';
import WalletSendConfirmationDialogContainer from '../../containers/wallet/dialogs/WalletSendConfirmationDialogContainer';
import styles from './WalletSendForm.scss';
import Asset from '../../domains/Asset';
import type { HwDeviceStatus } from '../../domains/Wallet';
import type { AssetToken, ApiTokens } from '../../api/assets/types';
import { DiscreetWalletAmount } from '../../features/discreet-mode';
import WalletTokenPicker from './tokens/wallet-token-picker/WalletTokenPicker';
import { ClearButton } from './widgets/ClearButton';
import { Divider } from './widgets/Divider';

messages.fieldIsRequired = globalMessages.fieldIsRequired;

type Props = {
  currencyMaxIntegerDigits: number;
  currencyMaxFractionalDigits: number;
  currentNumberFormat: string;
  calculateTransactionFee: (...args: Array<any>) => any;
  walletAmount: BigNumber;
  validateAmount: (amountInNaturalUnits: string) => Promise<boolean>;
  validateAssetAmount: (amountInNaturalUnits: string) => Promise<boolean>;
  addressValidator: (...args: Array<any>) => any;
  assets: Array<AssetToken>;
  hasAssets: boolean;
  selectedAsset: Asset | null | undefined;
  isLoadingAssets: boolean;
  isDialogOpen: (...args: Array<any>) => any;
  isRestoreActive: boolean;
  isHardwareWallet: boolean;
  hwDeviceStatus: HwDeviceStatus;
  onSubmit: (...args: Array<any>) => any;
  onUnsetActiveAsset: (...args: Array<any>) => any;
  onExternalLinkClick: (...args: Array<any>) => any;
  isAddressFromSameWallet: boolean;
  tokenFavorites: Record<string, boolean>;
  walletName: string;
  onTokenPickerDialogOpen: (...args: Array<any>) => any;
  onTokenPickerDialogClose: (...args: Array<any>) => any;
};

interface FormFields {
  receiver: string;
  adaAmount: string;
  [assets: string]: string;
}

type State = {
  formFields: {
    receiver: {
      receiver: Field;
      adaAmount: Field;
      assetFields: Record<string, Field>;
      assetsDropdown: Record<string, Field>;
    };
  };
  minimumAda: BigNumber;
  adaAmountInputTrack: BigNumber;
  feeCalculationRequestQue: number;
  transactionFee: BigNumber;
  transactionFeeError: (string | null | undefined) | (Node | null | undefined);
  selectedAssetUniqueIds: Array<string>;
  isResetButtonDisabled: boolean;
  isReceiverAddressValid: boolean;
  isReceiverAddressValidOnce: boolean;
  isTransactionFeeCalculated: boolean;
  isCalculatingTransactionFee: boolean;
  adaInputState: AdaInputState;
};

@observer
export default class WalletSendForm extends Component<Props, State> {
  static contextTypes = {
    intl: intlShape.isRequired,
  };
  state = {
    formFields: {} as State['formFields'],
    minimumAda: new BigNumber(0),
    feeCalculationRequestQue: 0,
    transactionFee: new BigNumber(0),
    transactionFeeError: null,
    showRemoveAssetButton: {},
    selectedAssetUniqueIds: [],
    isResetButtonDisabled: true,
    isReceiverAddressValid: false,
    isReceiverAddressValidOnce: false,
    isTransactionFeeCalculated: false,
    isCalculatingTransactionFee: false,
    adaInputState: AdaInputStateType.None,
  };

  // We need to track the fee calculation state in order to disable
  // the "Submit" button as soon as either receiver or amount field changes.
  // This is required as we are using debounced validation and we need to
  // disable the "Submit" button as soon as the value changes and then wait for
  // the validation to end in order to see if the button should be enabled or not.
  _isCalculatingTransactionFee = false;

  // We need to track the mounted state in order to avoid calling
  // setState promise handling code after the component was already unmounted:
  // Read more: https://facebook.github.io/react/blog/2015/12/16/ismounted-antipattern.html
  _isMounted = false;

  // We need to prevent auto focus of ada and token amount fields in case user pastes
  // or enters a receiver address which belongs to the same wallet he is sending from.
  _isAutoFocusEnabled = true;

  componentDidMount() {
    this._isMounted = true;
    this.updateFormFields(true);
    const { selectedAsset } = this.props;
    if (selectedAsset) {
      setTimeout(() => {
        if (this._isMounted) {
          this.addAssetRow(selectedAsset.uniqueId);
        }
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    this.props.onUnsetActiveAsset();
  }

  getCurrentNumberFormat() {
    return NUMBER_FORMATS[this.props.currentNumberFormat];
  }

  get selectedAssets(): Array<AssetToken> {
    const { selectedAssetUniqueIds } = this.state;
    const { assets: allAssets } = this.props;
    return map(selectedAssetUniqueIds, (uniqueId) =>
      allAssets.find((asset) => asset.uniqueId === uniqueId)
    );
  }

  get selectedAssetsAmounts(): Array<string> {
    const { selectedAssetUniqueIds, formFields } = this.state;
    const assetFields = get(formFields, 'receiver.assetFields');
    return map(selectedAssetUniqueIds, (uniqueId) =>
      formattedAmountToNaturalUnits(assetFields[uniqueId].value)
    );
  }

  get availableAssets(): Array<AssetToken> {
    const { assets: allAssets } = this.props;
    const { selectedAssetUniqueIds } = this.state;
    return filter(
      allAssets,
      ({ uniqueId }) => !selectedAssetUniqueIds.includes(uniqueId)
    );
  }

  get hasAvailableAssets(): boolean {
    return this.availableAssets.length > 0;
  }

  getAssetByUniqueId = (uniqueId: string): ?AssetToken => {
    const { assets: allAssets } = this.props;
    return allAssets.find((asset) => asset.uniqueId === uniqueId);
  };
  focusableFields: Record<string, Field> = {};
  addFocusableField = (field: Input | null | undefined) => {
    if (field) {
      const { name: fieldName } = field.props;
      this.focusableFields[fieldName] = field;
    }
  };

  focusField = (field: Field) => {
    const { name: fieldName } = field;
    const focusableField = this.focusableFields[fieldName];
    if (focusableField) {
      focusableField.focus();
    }
  };

  handleSubmitOnEnter = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement && event.key === 'Enter')
      this.handleOnSubmit();
  };

  handleOnSubmit = () => {
    if (this.isDisabled()) {
      return;
    }
    this.props.onSubmit();
  };

  handleOnReset = () => {
    // Cancel all debounced field validations
    this.form.each((field) => {
      field.debouncedValidation.cancel();
    });
    this.form.reset();
    this.form.showErrors(false);

    this.clearReceiverFieldValue();
    this.clearAdaAmountFieldValue();
    this.updateFormFields(true);

    this.setState({
      minimumAda: new BigNumber(0),
      showRemoveAssetButton: {},
      isResetButtonDisabled: true,
      adaInputState: AdaInputStateType.None,
      isReceiverAddressValidOnce: false,
    });
  };

  clearReceiverFieldValue = () => {
    const receiverField = this.form.$('receiver');
    if (receiverField) {
      receiverField.onChange('');
      this.setReceiverValidity(false);
      this.focusField(receiverField);
    }
  };

  clearAdaAmountFieldValue = () => {
    const adaAmountField = this.form.$('adaAmount');
    if (adaAmountField) {
      adaAmountField.clear();
    }
  };

  clearAssetFieldValue = (assetField: Field) => {
    if (assetField) {
      assetField.clear();
      this.focusField(assetField);
    }
    this.resetTransactionFee();
  };

  updateFormFields = (resetFormFields: boolean, uniqueId?: string) => {
    const formFields = this.form.fields;
    const receiverField = formFields.get('receiver');
    const adaAmountField = formFields.get('adaAmount');
    if (resetFormFields) {
      this.setState({
        selectedAssetUniqueIds: [],
        formFields: {
          receiver: {
            receiver: receiverField,
            adaAmount: adaAmountField,
            assetFields: {},
            assetsDropdown: {},
          },
        },
      });
    } else if (uniqueId) {
      const { assetFields, assetsDropdown } = this.state.formFields.receiver;
      const assetField = formFields.get(`asset_${uniqueId}`);
      if (assetField) {
        assetFields[uniqueId] = assetField;
      }
      const assetsDropdownField = formFields.get(`assetsDropdown_${uniqueId}`);
      if (assetsDropdownField) {
        assetsDropdown[uniqueId] = assetsDropdownField;
      }
      this.setState((prevState) => ({
        formFields: {
          ...prevState.formFields,
          receiver: {
            ...prevState.formFields.receiver,
            assetFields,
            assetsDropdown,
          },
        },
      }));
    }
  };

  hasReceiverValue = () => {
    const receiverField = this.form.$('receiver');
    return receiverField.value.length > 0;
  };
  hasAdaAmountValue = () => {
    const adaAmountField = this.form.$('adaAmount');
    return adaAmountField.value.length > 0;
  };
  isAddressFromSameWallet = () => {
    const { isAddressFromSameWallet } = this.props;
    const receiverField = this.form.$('receiver');
    return (
      this.hasReceiverValue() &&
      isAddressFromSameWallet &&
      receiverField.isValid
    );
  };

  isDisabled = () =>
    this._isCalculatingTransactionFee ||
    !this.state.isTransactionFeeCalculated ||
    !this.form.isValid ||
    this.form.validating;
  form = new ReactToolboxMobxForm<FormFields>(
    {
      fields: {
        receiver: {
          label: this.context.intl.formatMessage(messages.receiverLabel),
          placeholder: this.context.intl.formatMessage(messages.receiverHint),
          value: '',
          validators: [
            async ({ field, form }) => {
              const { value } = field;
              if (value === null || value === '') {
                this.resetTransactionFee();
                this.setReceiverValidity(false);
                return [
                  false,
                  this.context.intl.formatMessage(messages.fieldIsRequired),
                ];
              }
              const isValid = await this.props.addressValidator(value);
              if (isValid && this.isAddressFromSameWallet()) {
                this._isAutoFocusEnabled = false;
              }
              this.setReceiverValidity(isValid);
              const adaAmountField = form.$('adaAmount');
              const isAdaAmountValid = adaAmountField.isValid;
              if (isValid && isAdaAmountValid) {
                this.calculateTransactionFee();
              } else {
                this.resetTransactionFee();
              }
              return [
                isValid,
                this.context.intl.formatMessage(
                  apiErrorMessages.invalidAddress
                ),
              ];
            },
          ],
        },
        adaAmount: {
          label: this.context.intl.formatMessage(messages.adaAmountLabel),
          placeholder: `0${
            this.getCurrentNumberFormat().decimalSeparator
          }${'0'.repeat(this.props.currencyMaxFractionalDigits)}`,
          value: '',
          validators: [
            async ({ field }) => {
              const { value } = field;
              if (value === null || value === '') {
                this.resetTransactionFee();
                return [
                  false,
                  this.context.intl.formatMessage(messages.fieldIsRequired),
                ];
              }
              const amountValue = value.toString();
              const isValid = await this.props.validateAmount(
                formattedAmountToNaturalUnits(amountValue)
              );
              if (isValid) {
                this.calculateTransactionFee();
              } else {
                this.resetTransactionFee();
              }
              return [
                isValid,
                this.context.intl.formatMessage(messages.invalidAmount),
              ];
            },
          ],
        },
        estimatedFee: {
          label: this.context.intl.formatMessage(messages.estimatedFeeLabel),
          placeholder: `0${
            this.getCurrentNumberFormat().decimalSeparator
          }${'0'.repeat(this.props.currencyMaxFractionalDigits)}`,
          value: null,
        },
      },
    },
    {
      plugins: { vjf: vjf() },
      options: {
        validateOnBlur: false,
        validateOnChange: true,
        validationDebounceWait: FORM_VALIDATION_DEBOUNCE_WAIT,
      },
    }
  );

  setReceiverValidity(isValid: boolean) {
    if (this._isMounted) {
      this.setState(({ isReceiverAddressValidOnce }) => ({
        isReceiverAddressValid: isValid,
        isReceiverAddressValidOnce: isValid || isReceiverAddressValidOnce,
      }));
    }
  }

  isLatestTransactionFeeRequest = (
    currentFeeCalculationRequestQue: number,
    prevFeeCalculationRequestQue: number
  ) => currentFeeCalculationRequestQue - prevFeeCalculationRequestQue === 1;
  validateEmptyAssets = () => {
    return this.selectedAssets
      .filter((_, index) => {
        const quantity = new BigNumber(this.selectedAssetsAmounts[index]);
        return quantity.isZero();
      })
      .forEach(({ uniqueId }) => {
        this.form.$(`asset_${uniqueId}`).validate({
          showErrors: true,
        });
      });
  };
  calculateTransactionFee = async (shouldUpdateMinimumAdaAmount = false) => {
    if (!this.state.isReceiverAddressValid) {
      return;
    }

    this.validateEmptyAssets();
    const { form } = this;
    const receiverField = form.$('receiver');
    const receiver = receiverField.value;
    const adaAmountField = form.$('adaAmount');
    const adaAmount = formattedAmountToLovelace(adaAmountField.value);
    const assets: ApiTokens = filter(
      this.selectedAssets.map(({ policyId, assetName }, index) => {
        const quantity = new BigNumber(this.selectedAssetsAmounts[index]);
        return {
          policy_id: policyId,
          asset_name: assetName,
          quantity, // BigNumber or number - prevent parsing a BigNumber to Number (Integer) because of JS number length limitation
        };
      }),
      'quantity'
    );

    const {
      selectedAssetUniqueIds,
      feeCalculationRequestQue: prevFeeCalculationRequestQue,
    } = this.state;
    this.setState((prevState) => ({
      feeCalculationRequestQue: prevState.feeCalculationRequestQue + 1,
      isTransactionFeeCalculated: false,
      transactionFee: new BigNumber(0),
      transactionFeeError: null,
    }));
    try {
      this._isCalculatingTransactionFee = true;
      const { fee, minimumAda } = await this.props.calculateTransactionFee(
        receiver,
        adaAmount,
        assets
      );
      if (
        this._isMounted &&
        this.isLatestTransactionFeeRequest(
          this.state.feeCalculationRequestQue,
          prevFeeCalculationRequestQue
        ) &&
        !this.selectedAssetsAmounts.includes(emptyAssetFieldValue)
      ) {
        this._isCalculatingTransactionFee = false;
        this.setState({
          isTransactionFeeCalculated: true,
          minimumAda: minimumAda || new BigNumber(0),
          transactionFee: fee,
          transactionFeeError: null,
        });
      }
    } catch (error) {
      if (
        this._isMounted &&
        this.isLatestTransactionFeeRequest(
          this.state.feeCalculationRequestQue,
          prevFeeCalculationRequestQue
        )
      ) {
        const errorHasLink = !!get(error, ['values', 'linkLabel']);
        let transactionFeeError;
        let localizableError = error;
        let values;

        if (error.id === 'api.errors.utxoTooSmall') {
          const minimumAda = get(error, 'values.minimumAda');
          if (minimumAda && !Number.isNaN(Number(minimumAda))) {
            localizableError = selectedAssetUniqueIds.length
              ? messages.minAdaRequiredWithAssetTooltip
              : messages.minAdaRequiredWithNoAssetTooltip;
            values = { minimumAda };
            this.setState({ minimumAda: new BigNumber(minimumAda) });
          }
        }

        if (errorHasLink) {
          transactionFeeError = (
            <FormattedHTMLMessageWithLink
              message={localizableError}
              onExternalLinkClick={this.props.onExternalLinkClick}
            />
          );
        } else {
          transactionFeeError = (
            <FormattedHTMLMessage {...localizableError} values={values} />
          );
        }

        this.setState({ ...nextState, transactionFeeError });
      }
    }
  };
  checkAdaInputState = async (
    adaAmount: BigNumber,
    minimumAda: BigNumber
  ): Promise<AdaInputState> => {
    const {
      adaAmountInputTrack,
      selectedAssetUniqueIds,
      adaInputState,
    } = this.state;

    if (
      adaAmountInputTrack.gt(minimumAda) &&
      adaInputState === AdaInputStateType.Updated
    ) {
      return AdaInputStateType.Restored;
    }

    if (
      adaAmountInputTrack.lt(minimumAda) &&
      !isEmpty(selectedAssetUniqueIds)
    ) {
      const isValid = await this.props.validateAmount(
        formattedAmountToNaturalUnits(minimumAda.toString())
      );

      if (!isValid) {
        return AdaInputStateType.None;
      }
    }

    if (isEmpty(selectedAssetUniqueIds)) {
      return AdaInputStateType.Reset;
    }

    return AdaInputStateType.None;
  };
  trySetMinimumAdaAmount = (
    adaInputState: AdaInputState,
    minimumAda: BigNumber
  ) => {
    const { formFields } = this.state;
    const { adaAmount: adaAmountField } = formFields.receiver;

    switch (adaInputState) {
      case 'updated':
        adaAmountField.onChange(minimumAda.toString());
        break;

      case 'restored':
      case 'reset':
        adaAmountField.onChange(this.state.adaAmountInputTrack.toString());
        break;

      case 'none':
      default:
    }
  };
  updateAdaAmount = async () => {
    const { minimumAda } = this.state;
    const formattedMinimumAda = minimumAda.toString();
    const isValid = await this.props.validateAmount(
      formattedAmountToNaturalUnits(formattedMinimumAda)
    );

    if (!isValid) {
      return;
    }

    this.form.$('adaAmount').onChange(formattedMinimumAda);
    this.setState({
      adaInputState: AdaInputStateType.None,
      adaAmountInputTrack: minimumAda,
    });
  };
  onAdaAmountFieldChange = (value: string) => {
    const { formFields } = this.state;
    const { adaAmount: adaAmountField } = formFields.receiver;
    adaAmountField.onChange(value != null ? value : '');
    const adaAmount = new BigNumber(value != null ? value : 0);
    this.setState({
      adaAmountInputTrack: adaAmount,
      adaInputState: AdaInputStateType.None,
    });
  };
  isAdaAmountLessThanMinimumRequired = () => {
    const adaAmountField = this.form.$('adaAmount');
    const adaAmount = new BigNumber(adaAmountField.value || 0);
    return adaAmount.lt(this.state.minimumAda);
  };

  resetTransactionFee() {
    if (this._isMounted) {
      this._isCalculatingTransactionFee = false;
      this.setState({
        isTransactionFeeCalculated: false,
        transactionFee: new BigNumber(0),
        transactionFeeError: null,
      });
    }
  }

  showRemoveAssetButton = (uniqueId: string) => {
    const { showRemoveAssetButton } = this.state;
    showRemoveAssetButton[uniqueId] = true;
    this.setState({
      showRemoveAssetButton,
    });
  };

  hideRemoveAssetButton = (uniqueId: string) => {
    const { showRemoveAssetButton } = this.state;
    showRemoveAssetButton[uniqueId] = false;
    this.setState({
      showRemoveAssetButton,
    });
  };

  addAssetRow = (uniqueId: string) => {
    this.addAssetFields(uniqueId);
    this.updateFormFields(false, uniqueId);
    const { selectedAssetUniqueIds } = this.state;
    selectedAssetUniqueIds.push(uniqueId);
    this.setState({
      selectedAssetUniqueIds,
    });
    this.resetTransactionFee();
    this._isAutoFocusEnabled = true;
  };

  removeAssetRow = (uniqueId: string) => {
    const { formFields, selectedAssetUniqueIds } = this.state;
    const { receiver } = formFields;
    const assetFields = omit(receiver.assetFields, uniqueId);
    const assetsDropdown = omit(receiver.assetsDropdown, uniqueId);
    this.setState({
      selectedAssetUniqueIds: without(selectedAssetUniqueIds, uniqueId),
      formFields: {
        ...formFields,
        receiver: {
          ...receiver,
          assetFields,
          assetsDropdown,
        },
      },
    });
    this.removeAssetFields(uniqueId);
    setTimeout(() => {
      this.calculateTransactionFee();
    });
  };

  addAssetFields = (uniqueId: string) => {
    const newAsset = `asset_${uniqueId}`;
    this.form.add({
      name: newAsset,
      value: null,
      key: newAsset,
    });
    this.form
      .$(newAsset)
      .set('label', this.context.intl.formatMessage(messages.assetLabel));
    this.form
      .$(newAsset)
      .set(
        'placeholder',
        `0${this.getCurrentNumberFormat().decimalSeparator}${'0'.repeat(
          this.props.currencyMaxFractionalDigits
        )}`
      );
    this.form.$(newAsset).set('validators', [
      async ({ field }) => {
        const { value } = field;
        if (value === null || value === '') {
          this.resetTransactionFee();
          return [
            false,
            this.context.intl.formatMessage(messages.fieldIsRequired),
          ];
        }
        const amountValue = value.toString();
        const isValidAmount = await this.props.validateAssetAmount(
          formattedAmountToNaturalUnits(amountValue)
        );
        const asset = this.getAssetByUniqueId(uniqueId);
        if (!asset) {
          return false;
        }
        const assetValue = new BigNumber(
          formattedAmountToNaturalUnits(field.value)
        );
        const isValidRange =
          assetValue.isGreaterThan(0) &&
          assetValue.isLessThanOrEqualTo(asset.quantity);
        const isValid = isValidAmount && isValidRange;
        if (isValid) {
          this.calculateTransactionFee();
        } else {
          this.resetTransactionFee();
        }
        return [
          isValid,
          this.context.intl.formatMessage(messages.invalidAmount),
        ];
      },
    ]);

    const assetsDropdown = `assetsDropdown_${uniqueId}`;
    this.form.add({
      name: assetsDropdown,
      value: null,
      key: assetsDropdown,
    });
    this.form.$(assetsDropdown).set('type', 'select');
  };

  removeAssetFields = (uniqueId: string) => {
    const assetFieldToDelete = `asset_${uniqueId}`;
    this.form.del(assetFieldToDelete);
    const assetsDropdownFieldToDelete = `assetsDropdown_${uniqueId}`;
    this.form.del(assetsDropdownFieldToDelete);
  };

  onChangeAsset = async (currentUniqueId: string, newUniqueId: string) => {
    if (currentUniqueId === newUniqueId) return;
    this.addAssetFields(newUniqueId);
    this.updateFormFields(false, newUniqueId);
    const { selectedAssetUniqueIds: oldSelectedAssetUniqueIds } = this.state;
    const selectedAssetUniqueIds = [...oldSelectedAssetUniqueIds];
    const index = indexOf(selectedAssetUniqueIds, currentUniqueId);
    if (index > -1) {
      selectedAssetUniqueIds.splice(index, 1, newUniqueId);
    } else {
      selectedAssetUniqueIds.push(newUniqueId);
    }
    await this.setState({
      selectedAssetUniqueIds,
    });
    this.removeAssetRow(currentUniqueId);
    this.resetTransactionFee();
  };

  renderReceiverRow = (): Node => {
    const { intl } = this.context;
    const {
      formFields,
      minimumAda,
      transactionFeeError,
      selectedAssetUniqueIds,
      isReceiverAddressValidOnce,
    } = this.state;
    const {
      currencyMaxFractionalDigits,
      walletAmount,
      onTokenPickerDialogOpen,
    } = this.props;

    const {
      adaAmount: adaAmountField,
      receiver: receiverField,
      assetFields,
    } = formFields.receiver;

    const assetsSeparatorBasicHeight = 140;
    const assetsSeparatorCalculatedHeight = selectedAssetUniqueIds.length
      ? assetsSeparatorBasicHeight * (selectedAssetUniqueIds.length + 1) -
        40 * selectedAssetUniqueIds.length
      : assetsSeparatorBasicHeight;

    const minimumAdaValue = minimumAda.isZero()
      ? TRANSACTION_MIN_ADA_VALUE
      : minimumAda.toFormat();

    const addAssetButtonClasses = classNames([
      styles.addAssetButton,
      !this.hasAvailableAssets ? styles.disabled : null,
      'primary',
    ]);

    const receiverFieldClasses = classNames([
      styles.receiverInput,
      this.isAddressFromSameWallet() ? styles.sameReceiverInput : null,
    ]);

    const minAdaRequiredTooltip = selectedAssetUniqueIds.length
      ? messages.minAdaRequiredWithAssetTooltip
      : messages.minAdaRequiredWithNoAssetTooltip;

    const sameWalletError = intl.formatMessage(messages.sameWalletLabel);
    let receiverFieldError = receiverField.error;
    let receiverFieldThemeVars = {};
    if (this.isAddressFromSameWallet()) {
      receiverFieldError = sameWalletError;
      receiverFieldThemeVars = {
        '--rp-input-border-color-errored':
          'var(--rp-password-input-warning-score-color)',
        '--rp-pop-over-bg-color':
          'var(--rp-password-input-warning-score-color)',
      };
    }

    return (
      <div className={styles.fieldsContainer}>
        <div className={receiverFieldClasses}>
          <Input
            {...receiverField.bind()}
            ref={(field) => {
              this.addFocusableField(field);
            }}
            className="receiver"
            error={receiverFieldError}
            onChange={(value) => {
              receiverField.onChange(value || '');
              this.setState({
                isResetButtonDisabled: false,
              });
            }}
            onKeyPress={this.handleSubmitOnEnter}
            themeVariables={receiverFieldThemeVars}
          />
          {this.hasReceiverValue() && (
            <div className={styles.clearReceiverContainer}>
              <ClearButton
                label={intl.formatMessage(messages.clearLabel)}
                onClick={this.clearReceiverFieldValue}
              />
            </div>
          )}
        </div>
        {isReceiverAddressValidOnce && (
          <>
            <div
              className={styles.fieldsLine}
              style={{
                height: `${assetsSeparatorCalculatedHeight}px`,
                top: `${assetsSeparatorCalculatedHeight - 10}px`,
                marginTop: `-${assetsSeparatorCalculatedHeight}px`,
              }}
            />
            <div className={styles.assetInput}>
              <Fragment>
                {walletAmount && (
                  <div className={styles.amountTokenTotal}>
                    {intl.formatMessage(messages.ofLabel)}{' '}
                    <DiscreetWalletAmount amount={walletAmount} />
                  </div>
                )}
                <div className={styles.adaAmountLabel}>
                  {intl.formatMessage(globalMessages.adaUnit)}
                </div>
                <div className={styles.adaInput}>
                  <NumericInput
                    {...adaAmountField.bind()}
                    ref={(field) => {
                      this.addFocusableField(field);
                    }}
                    className="adaAmount"
                    bigNumberFormat={this.getCurrentNumberFormat()}
                    decimalPlaces={currencyMaxFractionalDigits}
                    numberLocaleOptions={{
                      minimumFractionDigits: currencyMaxFractionalDigits,
                    }}
                    onChange={this.onAdaAmountFieldChange}
                    currency={globalMessages.adaUnit}
                    error={adaAmountField.error || transactionFeeError}
                    onKeyPress={this.handleSubmitOnEnter}
                    allowSigns={false}
                    autoFocus={this._isAutoFocusEnabled}
                  />
                  {this.hasAdaAmountValue() && (
                    <div className={styles.clearAdaContainer}>
                      <ClearButton
                        label={intl.formatMessage(messages.clearLabel)}
                        onClick={this.clearAdaAmountFieldValue}
                      />
                      <div className={styles.dividerContainer}>
                        <Divider />
                      </div>
                    </div>
                  )}
                </div>
                <div
                  className={styles.minAdaRequired}
                  data-testid="minimumAdaRequiredMsg"
                >
                  {this.isAdaAmountLessThanMinimumRequired() ? (
                    <>
                      <Button
                        className={addAssetButtonClasses}
                        label={intl.formatMessage(
                          messages.updateAdaAmountButton
                        )}
                        onClick={this.updateAdaAmount}
                      />
                      <span>
                        {intl.formatMessage(
                          messages.updateAdaAmountDescription,
                          {
                            minimumAda: minimumAdaValue,
                          }
                        )}
                      </span>
                    </>
                  ) : (
                    <span>
                      {intl.formatMessage(messages.minAdaRequired, {
                        minimumAda: minimumAdaValue,
                      })}
                    </span>
                  )}

                  <PopOver
                    content={intl.formatMessage(minAdaRequiredTooltip, {
                      minimumAda: minimumAdaValue,
                    })}
                    contentClassName={styles.minAdaTooltipContent}
                    key="tooltip"
                  >
                    <SVGInline
                      svg={questionMarkIcon}
                      className={styles.infoIcon}
                    />
                  </PopOver>
                </div>
              </Fragment>
              <Fragment>
                {selectedAssetUniqueIds.map(
                  (uniqueId: string, index: number) => (
                    <AssetInput
                      key={uniqueId}
                      uniqueId={uniqueId}
                      index={index}
                      getAssetByUniqueId={this.getAssetByUniqueId}
                      availableAssets={this.availableAssets}
                      assetFields={assetFields}
                      assetsDropdown={assetsDropdown}
                      addFocusableField={this.addFocusableField}
                      removeAssetButtonVisible={
                        this.state.showRemoveAssetButton
                      }
                      showRemoveAssetButton={this.showRemoveAssetButton}
                      hideRemoveAssetButton={this.hideRemoveAssetButton}
                      currentNumberFormat={this.getCurrentNumberFormat()}
                      removeAssetRow={this.removeAssetRow}
                      handleSubmitOnEnter={this.handleSubmitOnEnter}
                      clearAssetFieldValue={this.clearAssetFieldValue}
                      onChangeAsset={(newUniqueId) =>
                        this.onChangeAsset(uniqueId, newUniqueId)
                      }
                      autoFocus={this._isAutoFocusEnabled}
                    />
                  )
                )}
              </Fragment>
              <Button
                className={addAssetButtonClasses}
                label={intl.formatMessage(messages.addAssetButtonLabel)}
                disabled={!this.hasAvailableAssets}
                onClick={onTokenPickerDialogOpen}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  render() {
    const { form } = this;
    const { intl } = this.context;
    const {
      formFields,
      transactionFee,
      transactionFeeError,
      isResetButtonDisabled,
      isTransactionFeeCalculated,
      selectedAssetUniqueIds,
    } = this.state;
    const {
      currencyMaxFractionalDigits,
      hwDeviceStatus,
      isHardwareWallet,
      isDialogOpen,
      isRestoreActive,
      onExternalLinkClick,
      tokenFavorites,
      walletName,
      onTokenPickerDialogClose,
    } = this.props;
    const receiverField = form.$('receiver');
    const receiver = receiverField.value;
    const adaAmountField = form.$('adaAmount');
    const adaAmount = new BigNumber(adaAmountField.value || 0);

    let fees = '0';
    let total: BigNumber = adaAmount;
    if (isTransactionFeeCalculated) {
      fees = transactionFee.toFormat(currencyMaxFractionalDigits);
      total = adaAmount.plus(transactionFee);
    }

    const calculatingFeesSpinnerButtonClasses = classNames([
      styles.calculatingFeesSpinnerButton,
      styles.spinning,
    ]);

    return (
      <div className={styles.component}>
        {isRestoreActive ? (
          <div className={styles.syncingTransactionsWrapper}>
            <LoadingSpinner big />
            <p className={styles.syncingTransactionsText}>
              {intl.formatMessage(messages.syncingTransactionsMessage)}
            </p>
          </div>
        ) : (
          <BorderedBox>
            <div className={styles.walletSendForm}>
              {formFields.receiver && this.renderReceiverRow()}
              <div className={styles.estimatedFeeInput}>
                <ReadOnlyInput
                  label={intl.formatMessage(messages.estimatedFeeLabel)}
                  value={
                    fees && !transactionFeeError
                      ? `${fees} ${intl.formatMessage(globalMessages.adaUnit)}`
                      : `0${
                          this.getCurrentNumberFormat().decimalSeparator
                        }${'0'.repeat(
                          this.props.currencyMaxFractionalDigits
                        )} ${intl.formatMessage(globalMessages.adaUnit)}`
                  }
                  isSet
                />
                {this._isCalculatingTransactionFee && (
                  <div className={styles.calculatingFeesContainer}>
                    <PopOver
                      content={intl.formatMessage(
                        messages.calculatingFeesLabel
                      )}
                    >
                      <button className={calculatingFeesSpinnerButtonClasses} />
                    </PopOver>
                  </div>
                )}
              </div>
              <div className={styles.buttonsContainer}>
                <Button
                  className="flat"
                  label={intl.formatMessage(messages.resetButtonLabel)}
                  disabled={isResetButtonDisabled}
                  onClick={this.handleOnReset}
                />
                <Button
                  className="primary"
                  label={intl.formatMessage(messages.sendButtonLabel)}
                  disabled={this.isDisabled()}
                  onClick={this.handleOnSubmit}
                />
              </div>
            </div>
          </BorderedBox>
        )}

        {isDialogOpen(WalletSendAssetsConfirmationDialog) ? (
          <WalletSendConfirmationDialogContainer
            receiver={receiver}
            selectedAssets={this.selectedAssets}
            assetsAmounts={this.selectedAssetsAmounts}
            amount={adaAmount.toFormat(currencyMaxFractionalDigits)}
            amountToNaturalUnits={formattedAmountToNaturalUnits}
            totalAmount={total}
            transactionFee={fees}
            hwDeviceStatus={hwDeviceStatus}
            isHardwareWallet={isHardwareWallet}
            onExternalLinkClick={onExternalLinkClick}
            formattedTotalAmount={total.toFormat(currencyMaxFractionalDigits)}
          />
        ) : null}

        {isDialogOpen(WalletTokenPicker) && (
          <WalletTokenPicker
            assets={assets}
            previouslyCheckedIds={selectedAssetUniqueIds}
            tokenFavorites={tokenFavorites}
            walletName={walletName}
            onCancel={onTokenPickerDialogClose}
            onAdd={(checked) => {
              onTokenPickerDialogClose();
              checked.forEach(this.addAssetRow);
            }}
          />
        )}
      </div>
    );
  }
}
