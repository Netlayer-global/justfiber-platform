import 'package:flutter/material.dart';

class FieldBackground extends StatelessWidget {
  const FieldBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFCFAF7), Color(0xFFF8F4EE), Color(0xFFF5F0EA)],
        ),
      ),
      child: child,
    );
  }
}
