import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "flex items-center justify-center gap-2 has-disabled:opacity-50",
      containerClassName
    )}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props}
  />
))
InputOTP.displayName = "InputOTP"

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center gap-2", className)} {...props} />
))
InputOTPGroup.displayName = "InputOTPGroup"

interface InputOTPSlotProps {
  index: number
  status?: "default" | "verifying" | "success" | "error"
  className?: string
}

const InputOTPSlot = React.forwardRef<
  HTMLDivElement,
  InputOTPSlotProps
>(({ index, className, status = "default" }, ref) => {


  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index]
  const [displayChar, setDisplayChar] = React.useState(char)
  const [isAnimating, setIsAnimating] = React.useState(false)

  // Deciphering animation effect
  React.useEffect(() => {
    if (status === "verifying" && char) {
      setIsAnimating(true)
      let iterations = 0
      const interval = setInterval(() => {
        setDisplayChar(Math.floor(Math.random() * 10).toString())
        iterations++
        if (iterations > 6) {
          clearInterval(interval)
          setDisplayChar(char)
          setIsAnimating(false)
        }
      }, 80)
      return () => clearInterval(interval)
    } else {
      setDisplayChar(char)
      setIsAnimating(false)
    }
  }, [status, char])

  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={{
        rotateY: isAnimating ? [0, 180, 360] : 0,
        scale: isActive ? 1.05 : 1,
        borderColor: 
          status === "success" ? "var(--color-success)" : 
          status === "error" ? "var(--color-destructive)" : 
          isActive ? "var(--color-primary)" : "var(--color-border)",
        backgroundColor:
          status === "success" ? "oklch(from var(--color-success) l c h / 0.1)" :
          status === "error" ? "oklch(from var(--color-destructive) l c h / 0.1)" :
          isActive ? "oklch(from var(--color-primary) l c h / 0.05)" : "var(--color-card)",
      }}
      transition={{ 
        duration: isAnimating ? 0.6 : 0.2,
        ease: "easeInOut"
      }}
      className={cn(
        "relative flex h-14 w-12 items-center justify-center rounded-xl border text-2xl font-bold shadow-sm sm:h-16 sm:w-14",
        status === "success" && "text-success",
        status === "error" && "text-destructive",
        className
      )}
      {...props}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={displayChar || "empty"}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.1 }}
        >
          {displayChar}
        </motion.span>
      </AnimatePresence>
      
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-px animate-caret-blink bg-primary duration-1000" />
        </div>
      )}

      {status === "success" && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[10px] text-success-foreground"
        >
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.div>
      )}
    </motion.div>
  )
})
InputOTPSlot.displayName = "InputOTPSlot"

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <div className="h-1 w-1 rounded-full bg-border" />
  </div>
))
InputOTPSeparator.displayName = "InputOTPSeparator"

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }

