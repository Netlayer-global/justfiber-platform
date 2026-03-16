import 'package:flutter/material.dart';

class UsageBar extends StatelessWidget {
  const UsageBar({super.key, required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    return LinearProgressIndicator(
      value: progress.clamp(0, 1),
      minHeight: 7,
      backgroundColor: const Color(0xFF2A314D),
      color: const Color(0xFFEF5DA8),
      borderRadius: BorderRadius.circular(999),
    );
  }
}
