import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/field_background.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final loginController = TextEditingController(text: '9000000001');
  final passwordController = TextEditingController(text: 'Installer123!');
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;

  @override
  void dispose() {
    loginController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit(InstallerAppState appState) async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) {
      return;
    }
    await appState.login(
      loginController.text.trim(),
      passwordController.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: FieldBackground(
        child: SafeArea(
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
              children: [
                const SizedBox(height: 36),
                Row(
                  children: [
                    Container(
                      width: 78,
                      height: 78,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFFFF),
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(color: const Color(0x338224E3)),
                      ),
                      child: const Icon(
                        Icons.network_check_rounded,
                        color: Color(0xFF8224E3),
                        size: 34,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8F4FF),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0x228224E3)),
                      ),
                      child: const Text(
                        'Field ready',
                        style: TextStyle(
                          color: Color(0xFF8224E3),
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 28),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: const Color(0x1F8224E3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'INSTALLER CONSOLE',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: const Color(0xFFE9D5FF),
                          letterSpacing: 3.2,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text('Sign in to field operations', style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white)),
                      const SizedBox(height: 12),
                      Text(
                        'Access assigned jobs, provisioning preview, route links, and activation controls from one installer app.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFFF3E8FF),
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0x338224E3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Demo field login',
                        style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Use installer credentials provided by admin. Default local demo credentials are prefilled for quick testing.',
                        style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                TextFormField(
                  controller: loginController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Phone or email',
                    hintText: 'Installer login',
                  ),
                  validator: (value) {
                    final text = (value ?? '').trim();
                    if (text.isEmpty) {
                      return 'Enter installer phone or email';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: passwordController,
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => appState.busy ? null : _submit(appState),
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: 'Installer password',
                    suffixIcon: IconButton(
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: const Color(0xFF9CA3AF),
                      ),
                    ),
                  ),
                  validator: (value) {
                    if ((value ?? '').isEmpty) {
                      return 'Enter installer password';
                    }
                    if ((value ?? '').length < 6) {
                      return 'Password looks too short';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy ? null : () => _submit(appState),
                    child: Text(appState.busy ? 'Signing in...' : 'Open Installer App'),
                  ),
                ),
                if ((appState.error ?? '').isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF1F2),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0x66EF4444)),
                    ),
                    child: Text(
                      appState.error!,
                      style: const TextStyle(color: Color(0xFFB91C1C), height: 1.4, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0x228224E3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Sign-in flow',
                        style: TextStyle(
                          color: Color(0xFF131313),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 10),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _flowRow('1', 'Sign in with installer credentials.'),
                _flowRow('2', 'Open assigned jobs and load provisioning preview.'),
                _flowRow('3', 'Reach site, enter serial, and run activation.'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _flowRow(String index, String text) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFF8F4FF),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0x228224E3)),
            ),
            child: Text(
              index,
              style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                text,
                style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
