import 'package:flutter_test/flutter_test.dart';
import 'package:omnipdf/main.dart';

void main() {
  testWidgets('Dashboard title smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const OmniPdfApp());

    // Verify that the Dashboard renders with the title "OmniPDF AI"
    expect(find.text('OmniPDF AI'), findsAtLeastNWidgets(1));
  });
}
