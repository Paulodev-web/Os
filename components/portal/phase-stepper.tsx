"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";
import { PROJECT_PHASES, phaseIndex } from "@/lib/phases";
import { dateBR } from "@/lib/format";

export function PhaseStepper({
  currentPhase,
  targetDate,
}: {
  currentPhase: string | null;
  targetDate: string | null;
}) {
  const currentIndex = phaseIndex(currentPhase);

  return (
    <div className="mt-6">
      <div className="flex overflow-x-auto pb-2">
        {PROJECT_PHASES.map((phase, i) => {
          const isDone = currentIndex >= 0 && i < currentIndex;
          const isCurrent = i === currentIndex;
          const isLast = i === PROJECT_PHASES.length - 1;

          return (
            <div
              key={phase.key}
              className="flex min-w-[92px] flex-1 flex-col items-center"
            >
              <div className="flex w-full items-center">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                  {isDone ? (
                    <CheckCircle2
                      size={22}
                      className="text-primary"
                      strokeWidth={2.4}
                    />
                  ) : isCurrent ? (
                    <>
                      <motion.span
                        className="absolute h-8 w-8 rounded-full bg-primary-soft"
                        animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <span className="relative h-4 w-4 rounded-full bg-primary" />
                    </>
                  ) : (
                    <Circle size={20} className="text-border" strokeWidth={2} />
                  )}
                </div>
                {!isLast && (
                  <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: isDone ? "100%" : "0%" }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                )}
              </div>
              <p
                className={`mt-2 max-w-[100px] text-center text-[11px] font-semibold leading-tight ${
                  isCurrent
                    ? "text-primary-dark"
                    : isDone
                      ? "text-foreground"
                      : "text-muted"
                }`}
              >
                {phase.label}
              </p>
            </div>
          );
        })}
      </div>
      {currentIndex >= 0 && targetDate && (
        <p className="mt-1 text-center text-xs text-muted sm:text-left">
          Previsão da fase atual: <strong>{dateBR(targetDate)}</strong>
        </p>
      )}
    </div>
  );
}
