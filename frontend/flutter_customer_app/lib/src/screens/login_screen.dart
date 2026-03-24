import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/gradient_orb_background.dart';
import 'booking_flow_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final mobileController = TextEditingController(text: '9876543210');
  final otpController = TextEditingController();
  final pageController = PageController();
  int activePage = 0;
  bool otpRequested = false;

  final slides = const [
    _AuthSlide(
      title: 'Pay your internet bills',
      subtitle: 'View monthly bills, open invoices, and complete payments in a few taps.',
      icon: Icons.receipt_long_rounded,
      statLeft: 'Bills',
      statLeftValue: 'Live',
      statRight: 'Status',
      statRightValue: 'Synced',
    ),
    _AuthSlide(
      title: 'Monitor your connection',
      subtitle: 'Track service health, device activity, and support requests from one clean control surface.',
      icon: Icons.wifi_rounded,
      statLeft: 'Wi-Fi',
      statLeftValue: '24x7',
      statRight: 'Support',
      statRightValue: 'Fast',
    ),
  ];

  @override
  void dispose() {
    mobileController.dispose();
    otpController.dispose();
    pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      body: GradientOrbBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFFFF),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0x228224E3)),
                      ),
                      child: const Icon(Icons.wifi_rounded, color: Color(0xFF8224E3), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'JUSTFIBER CONSOLE',
                            style: TextStyle(
                              color: Color(0xFF6E6A67),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 3.2,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Customer Access',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontSize: 24,
                              color: const Color(0xFF131313),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: pageController,
                  itemCount: slides.length,
                  onPageChanged: (value) => setState(() => activePage = value),
                  itemBuilder: (context, index) => _AuthShowcaseCard(slide: slides[index]),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    slides.length,
                    (index) => AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: activePage == index ? 24 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: activePage == index ? const Color(0xFF8224E3) : const Color(0xFFD9D1E9),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                ),
              ),
              Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFFFF),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: const Color(0x338224E3)),
                  boxShadow: const [
                    BoxShadow(color: Color(0x26000000), blurRadius: 20, offset: Offset(0, 10)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      otpRequested ? 'Enter OTP to continue' : 'Login with mobile number',
                      style: theme.textTheme.titleLarge?.copyWith(color: const Color(0xFF131313)),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      otpRequested
                          ? 'We sent a one-time password to your registered mobile number.'
                          : 'Use your registered number to receive an OTP and access your broadband account.',
                      style: theme.textTheme.bodyMedium?.copyWith(color: const Color(0xFF6E6A67)),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: mobileController,
                      keyboardType: TextInputType.phone,
                      textInputAction: otpRequested ? TextInputAction.next : TextInputAction.done,
                      decoration: const InputDecoration(
                        labelText: 'Mobile number',
                        hintText: 'Enter 10-digit mobile number',
                        prefixIcon: Icon(Icons.phone_android_rounded),
                      ),
                    ),
                    if (otpRequested) ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: otpController,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        decoration: const InputDecoration(
                          labelText: 'One-time password',
                          hintText: 'Enter OTP',
                          prefixIcon: Icon(Icons.password_rounded),
                        ),
                      ),
                    ],
                    if ((appState.error ?? '').isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF2A0F13),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0x66EF4444)),
                        ),
                        child: Text(
                          appState.error!,
                          style: const TextStyle(color: Color(0xFFFCA5A5), fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: appState.busy ? null : () => _handlePrimaryAction(appState),
                        child: Text(
                          appState.busy
                              ? (otpRequested ? 'Logging in...' : 'Sending OTP...')
                              : (otpRequested ? 'Submit & Login' : 'Send OTP'),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => BookingFlowScreen(initialMobile: mobileController.text.trim()),
                            ),
                          );
                          if (context.mounted) {
                            await appState.refresh();
                          }
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF8224E3),
                          side: const BorderSide(color: Color(0x558224E3)),
                          backgroundColor: const Color(0xFFFFFFFF),
                        ),
                        child: const Text('Book new connection'),
                      ),
                    ),
                    if (otpRequested) ...[
                      const SizedBox(height: 8),
                      Center(
                        child: TextButton(
                          onPressed: appState.busy
                              ? null
                              : () async {
                                  otpController.clear();
                                  await _sendOtp(appState);
                                },
                          child: const Text('Resend OTP'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handlePrimaryAction(AppState appState) async {
    if (!otpRequested) {
      await _sendOtp(appState);
      return;
    }
    await _verifyOtp(appState);
  }

  bool _validateMobile() {
    final mobile = mobileController.text.trim();
    if (mobile.length != 10 || int.tryParse(mobile) == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid 10-digit mobile number.')),
      );
      return false;
    }
    return true;
  }

  Future<void> _sendOtp(AppState appState) async {
    if (!_validateMobile()) return;
    await appState.requestOtp(mobileController.text.trim());
    if (!mounted) return;
    if ((appState.error ?? '').isEmpty) {
      setState(() => otpRequested = true);
    }
  }

  Future<void> _verifyOtp(AppState appState) async {
    if (!_validateMobile()) return;
    if (otpController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter OTP before continuing.')),
      );
      return;
    }
    await appState.verifyOtp(mobileController.text.trim(), otpController.text.trim());
  }
}

class _AuthSlide {
  const _AuthSlide({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.statLeft,
    required this.statLeftValue,
    required this.statRight,
    required this.statRightValue,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String statLeft;
  final String statLeftValue;
  final String statRight;
  final String statRightValue;
}

class _AuthShowcaseCard extends StatelessWidget {
  const _AuthShowcaseCard({required this.slide});

  final _AuthSlide slide;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      child: Column(
        children: [
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFFFFF), Color(0xFFF8F4FF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(34),
                border: Border.all(color: const Color(0x228224E3)),
                boxShadow: const [
                  BoxShadow(color: Color(0x22030B14), blurRadius: 24, offset: Offset(0, 10)),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                child: Column(
                  children: [
                    Expanded(
                      child: Center(
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              width: 260,
                              height: 260,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: RadialGradient(
                                  colors: [Color(0x338224E3), Color(0x00000000)],
                                ),
                              ),
                            ),
                            Container(
                              width: 200,
                              height: 200,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0x338224E3)),
                              ),
                            ),
                            Transform.rotate(
                              angle: -0.18,
                              child: Container(
                                width: 150,
                                height: 230,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFFF8F4FF), Color(0xFFFFFFFF)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(28),
                                  boxShadow: const [
                                    BoxShadow(color: Color(0x26030B14), blurRadius: 24, offset: Offset(0, 10)),
                                  ],
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    children: [
                                      Row(
                                        children: const [
                                          Expanded(
                                            child: Text(
                                              'Control',
                                              style: TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700),
                                            ),
                                          ),
                                          Icon(Icons.more_horiz_rounded, color: const Color(0x886E6A67)),
                                        ],
                                      ),
                                      const SizedBox(height: 16),
                                      Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF8F4FF),
                                          borderRadius: BorderRadius.circular(18),
                                          border: Border.all(color: const Color(0x338224E3)),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Icon(slide.icon, color: const Color(0xFF8224E3), size: 22),
                                            const SizedBox(height: 10),
                                            const Text(
                                              'Live sync',
                                              style: TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800),
                                            ),
                                            const SizedBox(height: 6),
                                            Container(
                                              height: 6,
                                              decoration: BoxDecoration(
                                                gradient: const LinearGradient(
                                                  colors: [Color(0xFF8224E3), Color(0x338224E3)],
                                                ),
                                                borderRadius: BorderRadius.circular(999),
                                              ),
                                            ),
                                            const SizedBox(height: 10),
                                            const Text(
                                              'Billing, plans, support, and bookings in one stream.',
                                              style: TextStyle(
                                                color: Color(0xFF6E6A67),
                                                fontSize: 11,
                                                height: 1.35,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              right: 18,
                              top: 40,
                              child: Container(
                                width: 160,
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFFFFFFFF), Color(0xFFF8F4FF)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(color: const Color(0x338224E3)),
                                  boxShadow: const [
                                    BoxShadow(color: Color(0x12030B14), blurRadius: 20, offset: Offset(0, 8)),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      slide.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF131313)),
                                    ),
                                    const SizedBox(height: 10),
                                    Row(
                                      children: [
                                        Expanded(child: _MiniStat(value: slide.statLeftValue, label: slide.statLeft)),
                                        const SizedBox(width: 8),
                                        Expanded(child: _MiniStat(value: slide.statRightValue, label: slide.statRight)),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      slide.title,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontSize: 26,
                            color: const Color(0xFFEFEEE8),
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      slide.subtitle,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.value,
    required this.label,
  });

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF8224E3))),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontSize: 11)),
      ],
    );
  }
}



