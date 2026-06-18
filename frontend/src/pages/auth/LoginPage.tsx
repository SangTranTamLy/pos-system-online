import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../api/auth.api";
import heroImage from "../../assets/brg_login.png";

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
        "flex-1 border-b-2 py-4 text-sm font-semibold tracking-[0.02em] transition-all",
        active
          ? "border-[#9d4300] text-[#9d4300]"
          : "border-transparent text-[#584237] hover:bg-[#eff4ff]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function LoginPage() {
  const [activeTab, setActiveTab] = useState<LoginTab>("staff");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [quickPin, setQuickPin] = useState("");
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
    setQuickPin((current) => (current.length >= 6 ? current : `${current}${digit}`));
  };

  const handleQuickBackspace = () => {
    setQuickPin((current) => current.slice(0, -1));
  };
  

  return (
    <main className="h-screen overflow-hidden bg-[#f8f9ff] font-sans text-[#0b1c30]">
      <div className="flex h-full min-h-0 w-full">
        <section className="relative hidden overflow-hidden lg:block lg:w-3/5">
          <div className="absolute inset-0 z-10 bg-linear-to-t from-black/60 to-transparent" />
          <img
            src={heroImage}
            alt="Busy Cafe POS Environment"
            className="h-full w-full object-cover"
          />

          <div className="absolute top-12 left-12 z-20">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#f97316] p-2">
                <Icon name="terminal" filled className="text-3xl text-[#341100]" />
              </div>
              <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-4xl font-bold text-white">
                QuickServe POS
              </h1>
            </div>
          </div>

          <div className="absolute right-12 bottom-12 left-12 z-20">
            <p className="max-w-2xl font-['Plus_Jakarta_Sans',sans-serif] text-3xl leading-snug font-semibold italic text-white/90">
              "Nâng tầm quy trình dịch vụ của bạn bằng tốc độ và sự chuẩn xác."
            </p>
          </div>
        </section>

        <section className="flex h-full min-h-0 w-full flex-col bg-white lg:w-2/5">
          <header className="flex shrink-0 justify-center px-6 py-4 lg:hidden">
            <div className="flex items-center gap-2">
              <Icon name="terminal" filled className="text-2xl text-[#9d4300]" />
              <span className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-bold text-[#9d4300]">
                QuickServe POS
              </span>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-6 md:px-16">
            <div className="w-full max-w-md">
              <div className="mb-6">
                <h2 className="mb-2 font-['Plus_Jakarta_Sans',sans-serif] text-4xl font-bold text-[#0b1c30]">
                  Chào Mừng 
                </h2>
                <p className="text-base text-[#584237]">
                  Đăng nhập để quản lý khu vực phục vụ và các giao dịch.
                </p>
              </div>

              <div className="mb-6 flex border-b border-[#e0c0b1]" role="tablist">
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

              <div className="min-h-32rem">
                {activeTab === "staff" ? (
                  <form className="space-y-4" onSubmit={handleStaffLogin}>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-semibold tracking-[0.02em]">
                        tài khoản
                      </label>
                      <div className="group relative rounded-lg border-2 border-[#e0c0b1] transition-all focus-within:border-[#f97316] focus-within:shadow-[0_0_0_2px_rgba(249,115,22,0.2)]">
                        <Icon
                          name="mail"
                          className="absolute top-1/2 left-3 -translate-y-1/2 text-[#584237]"
                        />
                        <input
                          id="email"
                          type="email"
                          placeholder="name@quickserve.com"
                          className="h-11 w-full border-none bg-transparent py-3 pr-4 pl-10 text-[#0b1c30] outline-none placeholder:text-[#584237]/50"
                          value={email} onChange={(event) => setEmail(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="password" className="text-sm font-semibold tracking-[0.02em]">
                          mật khẩu
                        </label>
                        <a href="#" className="text-sm font-semibold tracking-[0.02em] text-[#9d4300] hover:underline">
                          Quên mật khẩu?
                        </a>
                      </div>
                      <div className="group relative rounded-lg border-2 border-[#e0c0b1] transition-all focus-within:border-[#f97316] focus-within:shadow-[0_0_0_2px_rgba(249,115,22,0.2)]">
                        <Icon
                          name="lock"
                          className="absolute top-1/2 left-3 -translate-y-1/2 text-[#584237]"
                        />
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="********"
                          className="h-11 w-full border-none bg-transparent py-3 pr-12 pl-10 text-[#0b1c30] outline-none placeholder:text-[#584237]/50"
                          value={password} onChange={(event) => setPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-[#584237] transition-colors hover:text-[#9d4300]"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          <Icon name={showPassword ? "visibility_off" : "visibility"} />
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-6 w-6 rounded border-2 border-[#e0c0b1] accent-[#9d4300]"
                      />
                      <span className="text-base text-[#584237]">Lưu thiết bị này</span>
                    </label>
                    {errorMessage && (
                      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                        {errorMessage}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-[#f97316] py-3 font-['Plus_Jakarta_Sans',sans-serif] text-xl font-semibold text-white shadow-lg transition-all hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-4">
                    <div className="space-y-2 text-center">
                      <p className="text-sm font-semibold tracking-[0.02em] text-[#584237]">
                        Nhập mã nhân viên hoặc quét thẻ nhân viên
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="employee-id" className="text-sm font-semibold tracking-[0.02em]">
                        Nhân Viên ID / PIN
                      </label>
                      <div className="group relative rounded-lg border-2 border-[#e0c0b1] transition-all focus-within:border-[#f97316] focus-within:shadow-[0_0_0_2px_rgba(249,115,22,0.2)]">
                        <Icon
                          name="badge"
                          className="absolute top-1/2 left-3 -translate-y-1/2 text-[#584237]"
                        />
                        <input
                          id="employee-id"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={quickPin}
                          onChange={(event) =>
                            setQuickPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          placeholder="Nhập 6 chữ số PIN"
                          className="h-11 w-full border-none bg-transparent py-3 pr-4 pl-10 text-center text-[#0b1c30] tracking-[0.3em] outline-none placeholder:text-[#584237]/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => handleQuickDigit(digit)}
                          className="h-14 rounded-lg bg-[#e5eeff] font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-semibold transition-colors hover:bg-[#d3e4fe]"
                        >
                          {digit}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={handleQuickBackspace}
                        className="flex h-14 items-center justify-center rounded-lg text-[#ba1a1a] transition-colors hover:bg-[#ffdad6]"
                        aria-label="Delete digit"
                      >
                        <Icon name="backspace" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDigit("0")}
                        className="h-14 rounded-lg bg-[#e5eeff] font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-semibold transition-colors hover:bg-[#d3e4fe]"
                      >
                        0
                      </button>

                      <button
                        type="submit"
                        className="flex h-14 items-center justify-center rounded-lg text-[#9d4300] transition-colors hover:bg-[#ffdbca]"
                        aria-label="Confirm PIN"
                      >
                        <Icon name="check_circle" />
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-lg bg-[#f97316] py-3 font-['Plus_Jakarta_Sans',sans-serif] text-xl font-semibold text-white shadow-lg transition-all hover:brightness-110 active:translate-y-px"
                    >
                      Xác nhận đăng nhập
                    </button>
                  </form>
                )}
              </div>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold tracking-[0.02em] text-[#584237] transition-colors hover:text-[#9d4300]"
                >
                  <Icon name="help" />
                  Hỗ trợ đăng nhập?
                </button>
              </div>
            </div>
          </div>

          <footer className="flex flex-col items-center justify-between gap-4 shrink-0 border-t border-[#e0c0b1]/30 px-6 py-4 md:flex-row">
            <p className="text-sm font-semibold tracking-[0.02em] text-[#584237] opacity-60">
              Copyright 2024 QuickServe Systems. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <a href="#" className="text-sm font-semibold tracking-[0.02em] text-[#584237] transition-colors hover:text-[#9d4300]">
                Privacy Policy
              </a>
              <a href="#" className="text-sm font-semibold tracking-[0.02em] text-[#584237] transition-colors hover:text-[#9d4300]">
                Terms of Service
              </a>
              <a href="#" className="text-sm font-semibold tracking-[0.02em] text-[#584237] transition-colors hover:text-[#9d4300]">
                Security Compliance
              </a>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
