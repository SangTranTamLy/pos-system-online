import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login, loginPinApi } from "../../api/auth.api";
import heroImage from "../../assets/brg_login1.png";
import logoImage from "../../assets/logo-2.png";
import { useAppNotifications } from "../../components/common/AppNotificationsContext";

type LoginTab = "staff" | "quick";

function Icon({
  name,
  filled = false,
  className = "",
}: {
  name: string;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined inline-flex shrink-0 align-middle ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors duration-150",
        active
          ? "bg-[#f97316] text-white"
          : "bg-transparent text-[#735b4f] hover:bg-[#f5eae4]/50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function LoginPage() {
  const { notify } = useAppNotifications();
  const [activeTab, setActiveTab] = useState<LoginTab>("quick");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pin, setPin] = useState("");
  const navigate = useNavigate();

  const handleStaffLogin = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  try {
    setIsSubmitting(true);
    setErrorMessage("");

    const response = await login({
      email,
      password,
    });

    localStorage.setItem("accessToken", response.data.token);
    localStorage.setItem("auth_token", response.data.token);
    localStorage.setItem("auth_user", JSON.stringify(response.data.user));

    if (response.data.user.roleName.toLowerCase() === "staff") {
      navigate("/pos");
    } else {
      navigate("/dashboard");
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Đăng nhập thất bại";

    setErrorMessage(message);
  } finally {
    setIsSubmitting(false);
  }
};

  const handleQuickDigit = (digit: string) => {
    setPin((current) => (current.length >= 6 ? current : `${current}${digit}`));
  };

  const handleQuickBackspace = () => {
    setPin((current) => current.slice(0, -1));
  };

  const handleAutoLogin = async () => {
    if (pin.length !== 6) return;
    
    try {
      setIsSubmitting(true);
      const response = await loginPinApi(pin);
      
      localStorage.setItem("accessToken", response.data.token);
      localStorage.setItem("auth_token", response.data.token);
      localStorage.setItem("auth_user", JSON.stringify(response.data.user));

      const role = response.data.user.roleName.toLowerCase();
      if (role === 'admin' || role === 'manager' || role === 'quản lý' || role === 'quản trị viên') {
        navigate("/dashboard");
      } else if (role === 'staff' || role === 'cashier' || role === 'nhân viên thu ngân') {
        navigate("/pos");
      } else {
        navigate("/pos");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Đăng nhập thất bại";
      notify(message, "error");
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (pin.length === 6) {
      const timer = setTimeout(() => {
        void handleAutoLogin();
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);
  

  return (
    <main className="h-screen overflow-hidden bg-[#f8f9ff] font-sans text-[#0b1c30]">
      <div className="flex h-full min-h-0 w-full">
        {/* Left Hero Image Panel */}
        <section className="relative hidden overflow-hidden lg:block lg:w-3/5">
          <div className="absolute inset-0 z-10 bg-linear-to-t from-[#0b1c30]/10 via-transparent to-transparent" />
          <img
            src={heroImage}
            alt="Busy Cafe POS Environment"
            className="h-full w-full object-cover"
          />
        </section>

        {/* Right Form Panel */}
        <section className="flex h-full min-h-0 w-full flex-col bg-[#fdfcfb] lg:w-2/5 lg:border-l lg:border-[#e2d8d2]/40">
          <header className="flex shrink-0 justify-center px-6 py-4 lg:hidden bg-[#fdfcfb]">
            <div className="flex items-center gap-2">
              <Icon name="terminal" filled className="text-2xl text-[#f97316]" />
              <span className="font-['Outfit',sans-serif] text-2xl font-bold text-[#f97316] tracking-tight">
                QuickServe POS
              </span>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto overflow-x-hidden px-5 py-4 md:px-10 xl:px-14">
            <div className="w-full max-w-md rounded-2xl border border-orange-100/80 bg-white/90 p-7 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur xl:p-8">
              <div className="mb-5 xl:mb-6 text-center">
                {/* Logo */}
                <div className="mb-3 mx-auto flex h-21.25 w-21.25 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
                  <img
                    src={logoImage}
                    alt="QuickServe POS"
                    className="h-25 w-25 object-contain"
                  />
                </div>

                {/* Label */}
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f97316]">
                  Hệ thống POS
                </p>

                {/* Title */}
                <h2 className="mt-1 mb-2 font-['Outfit',sans-serif] text-[2rem] font-extrabold leading-tight text-[#0b1c30]">
                  Chào Mừng Trở Lại
                </h2>

                {/* Subtitle */}
                <p className="text-sm leading-relaxed text-[#735b4f]">
                  Đăng nhập để bắt đầu phiên làm việc và quản lý giao dịch.
                </p>
              </div>

              {/* Tab Selector */}
              <div className="mb-4 flex border border-[#e2d8d2] bg-[#fdfbf7] p-1" role="tablist">
                <TabButton
                  active={activeTab === "staff"}
                  label="Tài khoản nhân sự"
                  onClick={() => setActiveTab("staff")}
                />
                <TabButton
                  active={activeTab === "quick"}
                  label="Đăng nhập bằng mã PIN"
                  onClick={() => setActiveTab("quick")}
                />
              </div>

              {/* Forms Container */}
              <div className="min-h-0">
                {activeTab === "staff" ? (
                  <form className="space-y-4" onSubmit={handleStaffLogin}>
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-[#735b4f]">
                        Tài khoản / Email
                      </label>
                      <div className="group relative rounded-xl border border-[#d4beab] bg-[#fcfaf7] transition-colors duration-150 focus-within:border-[#f97316]">
                        <Icon
                          name="mail"
                          className="absolute top-1/2 left-3 -translate-y-1/2 text-[#8b6e60]"
                        />
                        <input
                          id="email"
                          type="email"
                          placeholder="name@quickserve.com"
                          className="h-11 w-full border-none bg-transparent py-3 pr-4 pl-10 text-[#0b1c30] outline-none placeholder:text-[#8b6e60]/40 text-sm"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-[#735b4f]">
                          Mật khẩu
                        </label>
                        <a href="#" className="text-xs font-bold uppercase tracking-wider text-[#f97316] hover:underline">
                          Quên mật khẩu?
                        </a>
                      </div>
                      <div className="group relative rounded-xl border border-[#d4beab] bg-[#fcfaf7] transition-colors duration-150 focus-within:border-[#f97316]">
                        <Icon
                          name="lock"
                          className="absolute top-1/2 left-3 -translate-y-1/2 text-[#8b6e60]"
                        />
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-11 w-full border-none bg-transparent py-3 pr-12 pl-10 text-[#0b1c30] outline-none placeholder:text-[#8b6e60]/40 text-sm"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-[#8b6e60] transition-colors duration-150 hover:text-[#f97316]"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          <Icon name={showPassword ? "visibility_off" : "visibility"} />
                        </button>
                      </div>
                    </div>

                    <div className="pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="h-4 w-4 border border-[#d4beab] bg-[#fcfaf7] accent-[#f97316] cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-[#735b4f] uppercase tracking-wider">Lưu thiết bị này</span>
                      </label>
                    </div>

                    {errorMessage && (
                      <p className="border border-red-200 bg-red-50/50 px-4 py-3 text-xs font-semibold text-red-700 uppercase tracking-wider">
                        {errorMessage}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#f97316] py-3.5 font-['Outfit',sans-serif] text-sm font-bold uppercase tracking-widest text-white transition-colors duration-150 hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập hệ thống"}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleAutoLogin(); }}>
                    <div className="text-center py-1">
                      <p className="text-xs uppercase font-bold tracking-wider text-[#8c7467]">
                        Nhập mã PIN cá nhân để đăng nhập nhanh
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="employee-id" className="text-xs font-bold uppercase tracking-wider text-[#735b4f]">
                        Mã PIN Nhân Viên
                      </label>
                      <div className="group relative rounded-xl border border-[#d4beab] bg-[#fcfaf7] transition-colors duration-150 focus-within:border-[#f97316]">
                        <Icon
                          name="badge"
                          className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[#8b6e60]"
                        />
                        <input
                          id="employee-id"
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={pin}
                          onChange={(event) =>
                            setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          placeholder="••••••"
                          className="h-11 w-full border-none bg-transparent py-3 pr-4 pl-10 text-center text-[#0b1c30] font-bold text-lg tracking-[0.6em] outline-none placeholder:text-[#8b6e60]/30"
                        />
                      </div>
                    </div>

                    {/* KEYPAD */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => handleQuickDigit(digit)}
                          className="h-12 border border-[#eadacf] bg-[#fcfaf8] font-['Outfit',sans-serif] text-xl font-bold text-[#4a3728] transition-colors duration-150 hover:bg-[#f3eae1] active:bg-[#eadacf]"
                        >
                          {digit}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={handleQuickBackspace}
                        className="flex h-12 items-center justify-center border border-[#fca5a5] bg-[#fff5f5] text-[#c2410c] transition-colors duration-150 hover:bg-[#fee2e2]"
                        aria-label="Delete digit"
                      >
                        <Icon name="backspace" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDigit("0")}
                        className="h-12 border border-[#eadacf] bg-[#fcfaf8] font-['Outfit',sans-serif] text-xl font-bold text-[#4a3728] transition-colors duration-150 hover:bg-[#f3eae1] active:bg-[#eadacf]"
                      >
                        0
                      </button>

                      <button
                        type="submit"
                        className="flex h-12 items-center justify-center border border-[#86efac] bg-[#f0fdf4] text-[#15803d] transition-colors duration-150 hover:bg-[#dcfce7]"
                        aria-label="Confirm PIN"
                      >
                        <Icon name="check_circle" />
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#f97316] py-3.5 font-['Outfit',sans-serif] text-sm font-bold uppercase tracking-widest text-white transition-colors duration-150 hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Xác nhận đăng nhập
                    </button>
                  </form>
                )}
              </div>

              {/* Help Support button */}
              <div className="mt-5 text-center">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider text-[#735b4f] transition-colors duration-150 hover:text-[#f97316]"
                >
                  <Icon name="help" />
                  Hỗ trợ đăng nhập?
                </button>
              </div>
            </div>
          </div>

          <footer className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-[#e2d8d2]/30 bg-[#f8f9ff] px-5 py-3 md:flex-row">
            <p className="text-xs font-medium tracking-[0.02em] text-[#8c7467]">
              Bản quyền © 2024 QuickServe Systems. Bảo lưu mọi quyền.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <a href="#" className="text-xs font-semibold tracking-[0.02em] text-[#8c7467] transition-colors duration-150 hover:text-[#f97316]">
                Chính sách bảo mật
              </a>
              <a href="#" className="text-xs font-semibold tracking-[0.02em] text-[#8c7467] transition-colors duration-150 hover:text-[#f97316]">
                Điều khoản dịch vụ
              </a>
              <a href="#" className="text-xs font-semibold tracking-[0.02em] text-[#8c7467] transition-colors duration-150 hover:text-[#f97316]">
                Tuân thủ bảo mật
              </a>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
