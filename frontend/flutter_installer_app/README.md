# Flutter Installer App

Modern field installer app scaffold for JustFiber.

## Run

```bash
cd frontend/flutter_installer_app
flutter pub get
flutter run
```

Default API base is `https://api.justfiber.in`.

Override it only for local testing:

```bash
flutter run --dart-define=JUSTFIBER_API_BASE=http://127.0.0.1:4000
```
