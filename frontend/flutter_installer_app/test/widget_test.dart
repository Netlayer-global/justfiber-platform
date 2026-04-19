import 'package:flutter_test/flutter_test.dart';

import 'package:justfiber_installer_app/src/app.dart';

void main() {
  testWidgets('installer app renders', (WidgetTester tester) async {
    await tester.pumpWidget(const JustFiberInstallerApp());
    await tester.pump();

    expect(find.text('JustFiber Field'), findsWidgets);
  });
}
