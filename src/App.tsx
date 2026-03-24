import React, { useEffect, useMemo, useState } from "react";

const API = "https://api.snabapp.ru";
const AUTH_KEY = "snab_auth_user";

type AuthUser = {
  user_id: string;
  full_name: string;
  phone: string;
  app_name: string;
};

type RequestItem = {
  row_number: number;
  created_at: string;
  item_text: string;
  photo_url: string;
  full_name: string;
  status: string;
  phone: string;
  delivery_date: string;
  manager_name: string;
  manager_comment: string;
  app_name: string;
  user_id: string;
  notification_sent: string;
};

function resolveFileUrl(url: string) {
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API}${url}`;
  }

  return `${API}/${url}`;
}

function loadAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAuthUser(user: AuthUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function clearAuthUser() {
  localStorage.removeItem(AUTH_KEY);
}

async function api(path: string, options?: RequestInit) {
  const res = await fetch(API + path, options);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || "Ошибка запроса");
  }

  return text ? JSON.parse(text) : null;
}

function formatDate(value: string) {
  if (!value) return "—";
  return value;
}

function statusBadge(status: string) {
  const base = "inline-flex rounded-full px-3 py-1 text-xs font-semibold";

  switch (status) {
    case "Отменен":
      return `${base} bg-red-100 text-red-700`;
    case "Не заказано":
      return `${base} bg-slate-200 text-slate-700`;
    case "В работе":
      return `${base} bg-amber-100 text-amber-700`;
    case "На согласование":
      return `${base} bg-violet-100 text-violet-700`;
    case "Поступило":
      return `${base} bg-green-100 text-green-700`;
    case "В доставке":
      return `${base} bg-sky-100 text-sky-700`;
    case "Часть заказа пришло":
      return `${base} bg-emerald-100 text-emerald-700`;
    case "В оплате":
      return `${base} bg-orange-100 text-orange-700`;
    default:
      return `${base} bg-slate-100 text-slate-700`;
  }
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          : "rounded-2xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
      }
    >
      {children}
    </button>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {children}
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
    />
  );
}

function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="min-h-[110px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
    />
  );
}

function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-300"
    >
      {children}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<"create" | "requests" | "profile">("create");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(loadAuthUser());

  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authStep, setAuthStep] = useState<"phone" | "set-password" | "login-password">("phone");

  const [form, setForm] = useState({
    item_text: "",
    quantity: "",
    usage_place: "",
    photo_link: "",
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [requestSearch, setRequestSearch] = useState("");
  const [requestSort, setRequestSort] = useState<"new" | "old">("new");
  const [requestStatusFilter, setRequestStatusFilter] = useState("Все");

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<RequestItem[]>([]);

  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    repeat_password: "",
  });

  function removeSelectedFile() {
    setPhotoFile(null);
  }

  async function checkPhone(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const res = await api("/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: loginPhone }),
      });

      if (res.has_password) {
        setAuthStep("login-password");
      } else {
        setAuthStep("set-password");
      }
    } catch {
      setMessage("Пользователь с таким номером не найден. Сначала должна быть заявка в базе.");
    } finally {
      setLoading(false);
    }
  }

  async function setPassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const user = await api("/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: loginPhone,
          password: loginPassword,
        }),
      });

      saveAuthUser(user);
      setAuthUser(user);
      setMessage(`Добрый день, ${user.full_name}`);
    } catch {
      setMessage("Не удалось установить пароль");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const user = await api("/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: loginPhone,
          password: loginPassword,
        }),
      });

      saveAuthUser(user);
      setAuthUser(user);
      setMessage(`Добрый день, ${user.full_name}`);
    } catch {
      setMessage("Неверный пароль");
    } finally {
      setLoading(false);
    }
  }

  async function restoreSession() {
    const saved = loadAuthUser();
    if (!saved || !saved.user_id) return;

    try {
      const fresh = await api("/auth/me/" + encodeURIComponent(saved.user_id));
      saveAuthUser(fresh);
      setAuthUser(fresh);
    } catch {
      clearAuthUser();
      setAuthUser(null);
    }
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser) return;

    setMessage("");
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("user_id", authUser.user_id);
      fd.append("app_name", authUser.app_name || "snab-app");
      fd.append("full_name", authUser.full_name);
      fd.append("phone", authUser.phone);
      fd.append("item_text", form.item_text);
      fd.append("quantity", form.quantity);
      fd.append("usage_place", form.usage_place);
      fd.append("product_link", "");
      fd.append("photo_link", form.photo_link);

      if (photoFile) {
        fd.append("photo_file", photoFile);
      }

      await api("/requests", {
        method: "POST",
        body: fd,
      });

      setMessage("Заявка отправлена ✅");
      setForm({
        item_text: "",
        quantity: "",
        usage_place: "",
        photo_link: "",
      });
      setPhotoFile(null);

      if (tab === "requests") {
        loadRequests();
      }
    } catch (e: any) {
      setMessage(e.message || "Ошибка создания заявки");
    } finally {
      setLoading(false);
    }
  }

  async function loadRequests() {
    if (!authUser || !authUser.user_id) return;

    setMessage("");
    setLoading(true);

    try {
      const res = await api("/requests/by-user/" + encodeURIComponent(authUser.user_id));
      setRequestItems(res || []);

      if (!res || !res.length) {
        setMessage("Заявки пока не найдены");
      }
    } catch (e: any) {
      setMessage(e.message || "Ошибка загрузки заявок");
    } finally {
      setLoading(false);
    }
  }

  async function checkNotifications() {
    if (!authUser || !authUser.user_id) return;

    try {
      const res = await api("/notifications/check/" + encodeURIComponent(authUser.user_id));
      if (res?.has_notification && res.items?.length) {
        setNotificationItems(res.items);
        setNotificationOpen(true);
      }
    } catch (e) {
      console.error("Ошибка проверки уведомлений", e);
    }
  }

  async function closeNotificationWindow() {
    try {
      const rowNumbers = notificationItems.map((item) => item.row_number);
      if (rowNumbers.length) {
        await api("/notifications/mark-sent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ row_numbers: rowNumbers }),
        });
      }
    } catch (e) {
      console.error("Ошибка отметки уведомления", e);
    } finally {
      setNotificationOpen(false);
      setNotificationItems([]);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser) return;

    setMessage("");
    setLoading(true);

    try {
      if (!passwordForm.old_password || !passwordForm.new_password) {
        setMessage("Заполните все поля пароля");
        return;
      }

      if (passwordForm.new_password !== passwordForm.repeat_password) {
        setMessage("Новые пароли не совпадают");
        return;
      }

      await api("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: authUser.user_id,
          old_password: passwordForm.old_password,
          new_password: passwordForm.new_password,
        }),
      });

      setPasswordForm({
        old_password: "",
        new_password: "",
        repeat_password: "",
      });

      setMessage("Пароль успешно изменен ✅");
    } catch (e: any) {
      setMessage(e.message || "Ошибка смены пароля");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearAuthUser();
    setAuthUser(null);
    setRequestItems([]);
    setLoginPhone("");
    setLoginPassword("");
    setAuthStep("phone");
    setMessage("Вы вышли из аккаунта");
  }

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (!authUser || !authUser.user_id) return;

    checkNotifications();

    const interval = setInterval(() => {
      checkNotifications();
    }, 15000);

    return () => clearInterval(interval);
  }, [authUser?.user_id]);

  useEffect(() => {
    if (!authUser || !authUser.user_id) return;
    if (tab === "requests") loadRequests();
  }, [tab, authUser?.user_id]);

  const filteredRequests = useMemo(() => {
    let items = [...requestItems];

    if (requestSearch.trim()) {
      const q = requestSearch.trim().toLowerCase();
      items = items.filter((item) =>
        (item.item_text || "").toLowerCase().includes(q)
      );
    }

    if (requestStatusFilter !== "Все") {
      items = items.filter((item) => item.status === requestStatusFilter);
    }

    items.sort((a, b) => {
      const aValue = a.row_number;
      const bValue = b.row_number;
      return requestSort === "new" ? bValue - aValue : aValue - bValue;
    });

    return items;
  }, [requestItems, requestSearch, requestSort, requestStatusFilter]);

  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-100 p-4">
        <div className="mx-auto max-w-md pt-12">
          <SectionCard>
            <h1 className="text-3xl font-bold text-slate-900">Snab App</h1>
            <p className="mt-2 text-sm text-slate-600">Вход по телефону и паролю</p>

            {message && (
              <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                {message}
              </div>
            )}

            <div className="mt-6">
              {authStep === "phone" && (
                <form onSubmit={checkPhone} className="grid gap-4">
                  <Field
                    placeholder="Телефон"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                  />
                  <PrimaryButton disabled={loading}>
                    {loading ? "Проверка..." : "Далее"}
                  </PrimaryButton>
                </form>
              )}

              {authStep === "set-password" && (
                <form onSubmit={setPassword} className="grid gap-4">
                  <div className="text-sm font-medium text-slate-700">Придумайте пароль</div>
                  <Field
                    type="password"
                    placeholder="Пароль"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <PrimaryButton disabled={loading}>
                    {loading ? "Сохранение..." : "Сохранить пароль и войти"}
                  </PrimaryButton>
                </form>
              )}

              {authStep === "login-password" && (
                <form onSubmit={loginWithPassword} className="grid gap-4">
                  <div className="text-sm font-medium text-slate-700">Введите пароль</div>
                  <Field
                    type="password"
                    placeholder="Пароль"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <PrimaryButton disabled={loading}>
                    {loading ? "Вход..." : "Войти"}
                  </PrimaryButton>
                </form>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionCard>
          <h1 className="text-3xl font-bold text-slate-900">Snab App</h1>
          <p className="mt-2 text-sm text-slate-600">
            Добрый день, <span className="font-semibold">{authUser.full_name}</span>
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <TabButton active={tab === "create"} onClick={() => setTab("create")}>
              Создать заявку
            </TabButton>
            <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
              Заявки
            </TabButton>
            <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
              Профиль
            </TabButton>
          </div>
        </SectionCard>

        {message && (
          <div className="rounded-3xl bg-white p-4 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
            {message}
          </div>
        )}

        {tab === "create" && (
          <SectionCard>
            <div className="mb-5 space-y-1 text-sm text-slate-700">
              <div><span className="font-semibold">ФИО:</span> {authUser.full_name}</div>
              <div><span className="font-semibold">Телефон:</span> {authUser.phone}</div>
            </div>

            <form onSubmit={createRequest} className="grid gap-4">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">
                  Что нужно заказать
                </div>
                <Area
                  placeholder="Опишите товар"
                  value={form.item_text}
                  onChange={(e) => setForm({ ...form, item_text: e.target.value })}
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">
                  Количество
                </div>
                <Field
                  placeholder="Напишите количество"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">
                  Где будет использоваться
                </div>
                <Field
                  placeholder="Напишите, где будет использоваться"
                  value={form.usage_place}
                  onChange={(e) => setForm({ ...form, usage_place: e.target.value })}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-800">
                  Фото товара или ссылка
                </div>

                <Field
                  placeholder="Если нет фотографии, вставьте ссылку на товар"
                  value={form.photo_link}
                  onChange={(e) => setForm({ ...form, photo_link: e.target.value })}
                />

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-2xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                    Выберите файл
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  {photoFile && (
                    <button
                      type="button"
                      onClick={removeSelectedFile}
                      className="rounded-2xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200"
                    >
                      Удалить файл
                    </button>
                  )}

                  <div className="text-sm text-slate-600">
                    {photoFile ? `Файл выбран: ${photoFile.name}` : "Файл не выбран"}
                  </div>
                </div>
              </div>

              <PrimaryButton disabled={loading}>
                {loading ? "Отправка..." : "Отправить заявку"}
              </PrimaryButton>
            </form>
          </SectionCard>
        )}

        {tab === "requests" && (
          <SectionCard>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1">
                <Field
                  placeholder="Поиск товара"
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                />
              </div>

              <select
                value={requestSort}
                onChange={(e) => setRequestSort(e.target.value as "new" | "old")}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                <option value="new">Новые</option>
                <option value="old">Старые</option>
              </select>

              <select
                value={requestStatusFilter}
                onChange={(e) => setRequestStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                <option value="Все">Все статусы</option>
                <option value="Отменен">Отменен</option>
                <option value="Не заказано">Не заказано</option>
                <option value="В работе">В работе</option>
                <option value="На согласование">На согласование</option>
                <option value="Поступило">Поступило</option>
                <option value="В доставке">В доставке</option>
                <option value="Часть заказа пришло">Часть заказа пришло</option>
                <option value="В оплате">В оплате</option>
              </select>

              <PrimaryButton onClick={loadRequests} disabled={loading}>
                {loading ? "Загрузка..." : "Обновить"}
              </PrimaryButton>
            </div>

            <div className="grid gap-4">
              {filteredRequests.map((i) => (
                <div key={i.row_number} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="text-lg font-semibold text-slate-900">{i.item_text}</div>
                    <div className={statusBadge(i.status)}>{i.status || "—"}</div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-700">
                    <div><span className="font-semibold">Дата отправки:</span> {formatDate(i.created_at)}</div>
                    <div><span className="font-semibold">Дата доставки:</span> {formatDate(i.delivery_date)}</div>
                    <div><span className="font-semibold">Ответственный:</span> {i.manager_name || "—"}</div>
                    <div><span className="font-semibold">Комментарий:</span> {i.manager_comment || "—"}</div>
                  </div>

                  {i.photo_url && (
                    <div className="mt-4 flex gap-4">
                      <a
                        href={resolveFileUrl(i.photo_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-slate-900 underline"
                      >
                        Открыть фото / ссылку
                      </a>

                      <a
                        href={resolveFileUrl(i.photo_url)}
                        download
                        className="text-sm font-medium text-slate-900 underline"
                      >
                        Скачать
                      </a>
                    </div>
                  )}
                </div>
              ))}

              {!loading && filteredRequests.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  По вашему запросу ничего не найдено
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {tab === "profile" && (
          <SectionCard>
            <h2 className="text-2xl font-semibold text-slate-900">Профиль</h2>

            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <div><span className="font-semibold">ФИО:</span> {authUser.full_name}</div>
              <div><span className="font-semibold">Телефон:</span> {authUser.phone}</div>
            </div>

            <form onSubmit={changePassword} className="mt-6 grid gap-4">
              <Field
                type="password"
                placeholder="Старый пароль"
                value={passwordForm.old_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
              />

              <Field
                type="password"
                placeholder="Новый пароль"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              />

              <Field
                type="password"
                placeholder="Повторите новый пароль"
                value={passwordForm.repeat_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, repeat_password: e.target.value })}
              />

              <div className="flex flex-wrap gap-3">
                <PrimaryButton disabled={loading}>
                  {loading ? "Сохранение..." : "Сменить пароль"}
                </PrimaryButton>
                <SecondaryButton onClick={logout} type="button">
                  Выйти из аккаунта
                </SecondaryButton>
              </div>
            </form>
          </SectionCard>
        )}
      </div>

      {notificationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold text-slate-900">Уведомление</h2>
            <p className="mt-2 text-sm text-slate-600">По вашим заявкам поступили товары:</p>

            <div className="mt-5 grid gap-3">
              {notificationItems.map((item) => (
                <div key={item.row_number} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">{item.item_text}</div>
                  <div className="mt-2"><span className="font-semibold">Статус:</span> {item.status}</div>
                  <div><span className="font-semibold">Дата доставки:</span> {formatDate(item.delivery_date)}</div>
                  <div><span className="font-semibold">Ответственный:</span> {item.manager_name || "—"}</div>
                  <div><span className="font-semibold">Комментарий:</span> {item.manager_comment || "—"}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <PrimaryButton onClick={closeNotificationWindow}>Закрыть</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}