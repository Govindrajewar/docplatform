import { motion, type HTMLMotionProps } from 'framer-motion';

export function FadeIn({ className, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={className}
      {...props}
    />
  );
}
