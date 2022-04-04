import React, { Component } from 'react';
import WalletCreateDialog from './WalletCreateDialog';
import commonStyles from './WalletCreateStyles.scss';

type Props = {
  onContinue: (...args: Array<any>) => any;
  onClose: (...args: Array<any>) => any;
};
export default class MnemonicsDialog extends Component<Props> {
  render() {
    const { onContinue, onClose } = this.props;
    return (
      <WalletCreateDialog
        stepNumber={2}
        actions={[
          {
            primary: true,
            label: 'Continue',
            onClick: onContinue,
          },
        ]}
        onClose={onClose}
      >
        <div className={commonStyles.component}>MNEMONICS STEP CONTENT</div>
      </WalletCreateDialog>
    );
  }
}
