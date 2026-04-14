# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Talking Tom / «повторялка» (test task)

Добавлен экран `Talk` (вкладка) — авто-запись голоса и воспроизведение назад с повышенным pitch.

### Setup

1. Скачайте `.riv` из Rive community:
   https://rive.app/community/files/5628-11215-wave-hear-and-talk/

2. Положите файл в проект как:

- `assets/rive/talking_tom.riv`

(именно это имя сейчас ожидает `app/(tabs)/talk.tsx`).

3. Запустите приложение.

### Как работает

- Никаких кнопок: экран при монтировании автоматически запрашивает доступ к микрофону и стартует запись.
- Чтобы детектировать «пользователь начал/перестал говорить», используется `metering` из `expo-av`.
  В Expo нет отдельного API для получения громкости микрофона без записи, поэтому запись запускается сразу,
  а авто-стоп происходит после ~1 секунды тишины.
- После остановки записи файл воспроизводится назад с повышенной высотой голоса через `Audio.Sound`:
  в `expo-av` это достигается увеличением `rate` и включением `shouldCorrectPitch`.

### Ограничения/заметки

- Управление анимацией Rive (переключение state machine inputs) зависит от конкретных имён в `.riv`.
  В `TalkScreen` оставлен хук `setRiveState(...)`, куда можно подцепить нужные триггеры/inputs.
- Web-сборка: функциональность микрофона/аудио для такого сценария отличается, таргет — iOS/Android.
