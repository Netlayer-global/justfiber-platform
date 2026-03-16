import 'package:flutter/material.dart';

class StatBarChart extends StatelessWidget {
  const StatBarChart({super.key});

  @override
  Widget build(BuildContext context) {
    const values = [0.38, 0.76, 0.62, 0.88, 0.42];
    const colors = [
      Color(0xFFA2B2FF),
      Color(0xFFFF8A7B),
      Color(0xFFC3BAFF),
      Color(0xFFFF8A7B),
      Color(0xFFA2B2FF),
    ];
    const labels = ['00.00', '06.00', '12.00', '18.00', '24.00'];
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: List.generate(values.length, (index) {
        return Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Container(
              width: 32,
              height: 180 * values[index],
              decoration: BoxDecoration(
                color: colors[index],
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            const SizedBox(height: 10),
            Text(labels[index], style: const TextStyle(fontSize: 11, color: Color(0xFFA3A9C2))),
          ],
        );
      }),
    );
  }
}
