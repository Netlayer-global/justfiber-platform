import 'package:flutter/material.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.gradient,
    this.padding = const EdgeInsets.all(20),
  });

  final Widget child;
  final Gradient? gradient;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? Colors.white : null,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: gradient == null ? const Color(0xFFDDFCF8) : Colors.transparent,
          width: 1,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x16030B14), blurRadius: 28, offset: Offset(0, 14)),
          BoxShadow(color: Color(0x1239FF14), blurRadius: 6, offset: Offset(0, 0)),
        ],
      ),
      child: child,
    );
  }
}

