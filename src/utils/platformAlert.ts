import { Alert as NativeAlert, Platform } from 'react-native';

type PlatformAlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export const Alert = {
  alert(title: string, message?: string, buttons?: PlatformAlertButton[]) {
    if (Platform.OS !== 'web') {
      NativeAlert.alert(title, message, buttons);
      return;
    }

    const description = message ? `${title}\n\n${message}` : title;

    if (!buttons?.length) {
      window.alert(description);
      return;
    }

    if (buttons.length === 1) {
      window.alert(description);
      buttons[0].onPress?.();
      return;
    }

    if (buttons.length === 2) {
      const cancelButton =
        buttons.find((button) => button.style === 'cancel') ?? buttons[0];
      const actionButton =
        buttons.find((button) => button !== cancelButton) ?? buttons[1];

      const confirmed = window.confirm(
        `${description}\n\n${actionButton.text ?? 'Continuar'}?`,
      );

      if (confirmed) {
        actionButton.onPress?.();
      } else {
        cancelButton.onPress?.();
      }
      return;
    }

    const options = buttons
      .map((button, index) => `${index + 1}. ${button.text ?? 'Opção'}`)
      .join('\n');

    const answer = window.prompt(
      `${description}\n\n${options}\n\nDigite o número da opção:`,
    );

    if (answer === null) return;

    const selectedIndex = Number(answer) - 1;
    if (
      Number.isInteger(selectedIndex) &&
      selectedIndex >= 0 &&
      selectedIndex < buttons.length
    ) {
      buttons[selectedIndex].onPress?.();
    }
  },
};
