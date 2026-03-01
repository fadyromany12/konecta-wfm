"use client";

import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";

const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const fadeInItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.32, 0.72, 0, 1],
    },
  },
};

const pageTransitionVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.35,
      ease: [0.32, 0.72, 0, 1],
    },
  },
};

/** Container that staggers its children with a smooth cascade (use with FadeInItem). */
export function FadeInStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/** Child item that slides up and fades in (use inside FadeInStagger). */
export function FadeInItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={fadeInItemVariants}>
      {children}
    </motion.div>
  );
}

/** Wraps page content for a buttery page-load transition. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="hidden"
      animate="visible"
      style={{ willChange: "opacity" }}
    >
      {children}
    </motion.div>
  );
}
