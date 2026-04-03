import 'package:flutter/material.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.gradient,
    this.color,
    this.borderColor,
    this.textColor,
    this.padding = const EdgeInsets.all(20),
  });

  final Widget child;
  final Gradient? gradient;
  final Color? color;
  final Color? borderColor;
  final Color? textColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DefaultTextStyle.merge(
      style: textColor != null ? TextStyle(color: textColor) : const TextStyle(),
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          gradient: gradient,
          color: gradient == null ? (color ?? Colors.white.withOpacity(0.9)) : null,
          borderRadius: BorderRadius.circular(24),
          border: gradient == null ? Border.all(color: borderColor ?? const Color(0xFFD8E1EE)) : null,
          boxShadow: const [
            BoxShadow(color: Color(0x12142033), blurRadius: 32, offset: Offset(0, 14)),
          ],
        ),
        child: child,
      ),
    );
  }
}
