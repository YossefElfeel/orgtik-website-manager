export declare const STATUS_MATRIX: {
    readonly tool_state: {
        readonly active: {
            readonly tone: "success";
            readonly icon: "CheckCircle";
            readonly label: {
                readonly en: "Active";
                readonly ar: "مفعّلة";
                readonly de: "Aktiv";
                readonly fr: "Actif";
                readonly it: "Attivo";
            };
            readonly next: readonly ["read_only", "not_subscribed"];
        };
        readonly trial: {
            readonly tone: "info";
            readonly icon: "Timer";
            readonly label: {
                readonly en: "Trial";
                readonly ar: "تجربة";
                readonly de: "Testphase";
                readonly fr: "Essai";
                readonly it: "Prova";
            };
            readonly next: readonly ["active", "not_subscribed"];
        };
        readonly beta: {
            readonly tone: "brand";
            readonly icon: "Flask";
            readonly label: {
                readonly en: "Beta";
                readonly ar: "إصدار تجريبي";
                readonly de: "Beta";
                readonly fr: "Bêta";
                readonly it: "Beta";
            };
            readonly next: readonly ["active"];
        };
        readonly read_only: {
            readonly tone: "danger";
            readonly icon: "WarningCircle";
            readonly label: {
                readonly en: "Read-only";
                readonly ar: "للقراءة فقط";
                readonly de: "Nur Ansicht";
                readonly fr: "Lecture seule";
                readonly it: "Sola lettura";
            };
            readonly next: readonly ["active"];
        };
        readonly not_subscribed: {
            readonly tone: "neutral";
            readonly icon: "LockSimple";
            readonly label: {
                readonly en: "Not subscribed";
                readonly ar: "غير مشترك";
                readonly de: "Nicht abonniert";
                readonly fr: "Non souscrit";
                readonly it: "Non sottoscritto";
            };
            readonly next: readonly ["trial", "active"];
        };
        readonly coming_soon: {
            readonly tone: "neutral";
            readonly icon: "ClockCountdown";
            readonly label: {
                readonly en: "Coming soon";
                readonly ar: "قريبًا";
                readonly de: "Demnächst";
                readonly fr: "Bientôt disponible";
                readonly it: "Prossimamente";
            };
            readonly next: readonly ["beta", "active"];
        };
        readonly no_access: {
            readonly tone: "neutral";
            readonly icon: null;
            readonly label: {
                readonly en: "No access";
                readonly ar: "بدون صلاحية";
                readonly de: "Kein Zugriff";
                readonly fr: "Aucun accès";
                readonly it: "Nessun accesso";
            };
            readonly next: readonly ["active"];
        };
    };
    readonly subscription_line: {
        readonly trialing: {
            readonly tone: "info";
            readonly icon: "Timer";
            readonly label: {
                readonly en: "Trial";
                readonly ar: "تجربة";
                readonly de: "Testphase";
                readonly fr: "Essai";
                readonly it: "Prova";
            };
            readonly next: readonly ["active", "free", "ended"];
        };
        readonly active: {
            readonly tone: "success";
            readonly icon: "CheckCircle";
            readonly label: {
                readonly en: "Active";
                readonly ar: "نشط";
                readonly de: "Aktiv";
                readonly fr: "Actif";
                readonly it: "Attivo";
            };
            readonly next: readonly ["past_due", "cancelling"];
        };
        readonly past_due: {
            readonly tone: "warning";
            readonly icon: "Warning";
            readonly label: {
                readonly en: "Past due";
                readonly ar: "متأخر السداد";
                readonly de: "Überfällig";
                readonly fr: "Paiement en retard";
                readonly it: "Pagamento scaduto";
            };
            readonly next: readonly ["active", "read_only"];
        };
        readonly read_only: {
            readonly tone: "danger";
            readonly icon: "WarningCircle";
            readonly label: {
                readonly en: "Read-only";
                readonly ar: "للقراءة فقط";
                readonly de: "Nur Ansicht";
                readonly fr: "Lecture seule";
                readonly it: "Sola lettura";
            };
            readonly next: readonly ["active", "ended"];
        };
        readonly cancelling: {
            readonly tone: "warning";
            readonly icon: "HourglassMedium";
            readonly label: {
                readonly en: "Cancelling";
                readonly ar: "قيد الإلغاء";
                readonly de: "Wird gekündigt";
                readonly fr: "Résiliation en cours";
                readonly it: "In disdetta";
            };
            readonly next: readonly ["active (undo)", "ended"];
        };
        readonly free: {
            readonly tone: "neutral";
            readonly icon: "Gift";
            readonly label: {
                readonly en: "Free";
                readonly ar: "مجاني";
                readonly de: "Kostenlos";
                readonly fr: "Gratuit";
                readonly it: "Gratuito";
            };
            readonly next: readonly ["active", "trialing"];
        };
        readonly ended: {
            readonly tone: "neutral";
            readonly icon: "MinusCircle";
            readonly label: {
                readonly en: "Ended";
                readonly ar: "منتهي";
                readonly de: "Beendet";
                readonly fr: "Terminé";
                readonly it: "Terminato";
            };
            readonly next: readonly ["active (restore)", "deleted"];
        };
        readonly deleted: {
            readonly tone: "neutral";
            readonly icon: "Trash";
            readonly label: {
                readonly en: "Deleted";
                readonly ar: "محذوف";
                readonly de: "Gelöscht";
                readonly fr: "Supprimé";
                readonly it: "Eliminato";
            };
            readonly next: readonly [];
        };
    };
    readonly workspace: {
        readonly active: {
            readonly tone: "success";
            readonly icon: "CheckCircle";
            readonly label: {
                readonly en: "Active";
                readonly ar: "نشطة";
                readonly de: "Aktiv";
                readonly fr: "Actif";
                readonly it: "Attivo";
            };
            readonly next: readonly ["past_due", "suspended", "cancelled"];
        };
        readonly past_due: {
            readonly tone: "warning";
            readonly icon: "Warning";
            readonly label: {
                readonly en: "Past due";
                readonly ar: "متأخرة السداد";
                readonly de: "Überfällig";
                readonly fr: "Paiement en retard";
                readonly it: "Pagamento scaduto";
            };
            readonly next: readonly ["active", "cancelled"];
        };
        readonly suspended: {
            readonly tone: "danger";
            readonly icon: "Prohibit";
            readonly label: {
                readonly en: "Suspended";
                readonly ar: "موقوفة";
                readonly de: "Gesperrt";
                readonly fr: "Suspendu";
                readonly it: "Sospeso";
            };
            readonly next: readonly ["active", "cancelled"];
        };
        readonly cancelled: {
            readonly tone: "neutral";
            readonly icon: "MinusCircle";
            readonly label: {
                readonly en: "Cancelled";
                readonly ar: "ملغاة";
                readonly de: "Gekündigt";
                readonly fr: "Résilié";
                readonly it: "Disdetto";
            };
            readonly next: readonly ["active (reactivate)", "deleted"];
        };
        readonly deleted: {
            readonly tone: "neutral";
            readonly icon: "Trash";
            readonly label: {
                readonly en: "Deleted";
                readonly ar: "محذوفة";
                readonly de: "Gelöscht";
                readonly fr: "Supprimé";
                readonly it: "Eliminato";
            };
            readonly next: readonly [];
        };
    };
    readonly invoice: {
        readonly draft: {
            readonly tone: "neutral";
            readonly icon: "PencilSimple";
            readonly label: {
                readonly en: "Draft";
                readonly ar: "مسودة";
                readonly de: "Entwurf";
                readonly fr: "Brouillon";
                readonly it: "Bozza";
            };
            readonly next: readonly ["open", "void"];
        };
        readonly open: {
            readonly tone: "info";
            readonly icon: "Clock";
            readonly label: {
                readonly en: "Open";
                readonly ar: "مفتوحة";
                readonly de: "Offen";
                readonly fr: "À payer";
                readonly it: "Da pagare";
            };
            readonly next: readonly ["paid", "past_due", "void"];
        };
        readonly past_due: {
            readonly tone: "warning";
            readonly icon: "Warning";
            readonly label: {
                readonly en: "Past due";
                readonly ar: "متأخرة";
                readonly de: "Überfällig";
                readonly fr: "En retard";
                readonly it: "Scaduta";
            };
            readonly next: readonly ["paid", "void"];
        };
        readonly paid: {
            readonly tone: "success";
            readonly icon: "CheckCircle";
            readonly label: {
                readonly en: "Paid";
                readonly ar: "مدفوعة";
                readonly de: "Bezahlt";
                readonly fr: "Payée";
                readonly it: "Pagata";
            };
            readonly next: readonly ["partially_refunded", "refunded"];
        };
        readonly partially_refunded: {
            readonly tone: "neutral";
            readonly icon: "ArrowCounterClockwise";
            readonly label: {
                readonly en: "Partially refunded";
                readonly ar: "مستردة جزئيًا";
                readonly de: "Teilweise erstattet";
                readonly fr: "Partiellement remboursée";
                readonly it: "Parzialmente rimborsata";
            };
            readonly next: readonly ["refunded"];
        };
        readonly refunded: {
            readonly tone: "neutral";
            readonly icon: "ArrowCounterClockwise";
            readonly label: {
                readonly en: "Refunded";
                readonly ar: "مستردة";
                readonly de: "Erstattet";
                readonly fr: "Remboursée";
                readonly it: "Rimborsata";
            };
            readonly next: readonly [];
        };
        readonly void: {
            readonly tone: "neutral";
            readonly icon: "Prohibit";
            readonly label: {
                readonly en: "Void";
                readonly ar: "ملغاة";
                readonly de: "Storniert";
                readonly fr: "Annulée";
                readonly it: "Annullata";
            };
            readonly next: readonly [];
        };
    };
    readonly service_request: {
        readonly new: {
            readonly tone: "info";
            readonly icon: "Circle";
            readonly label: {
                readonly en: "New";
                readonly ar: "جديد";
                readonly de: "Neu";
                readonly fr: "Nouvelle";
                readonly it: "Nuova";
            };
            readonly next: readonly ["under_review", "cancelled"];
        };
        readonly under_review: {
            readonly tone: "info";
            readonly icon: "MagnifyingGlass";
            readonly label: {
                readonly en: "Under review";
                readonly ar: "قيد المراجعة";
                readonly de: "In Prüfung";
                readonly fr: "En cours d'examen";
                readonly it: "In valutazione";
            };
            readonly next: readonly ["quoted", "cancelled"];
        };
        readonly quoted: {
            readonly tone: "warning";
            readonly icon: "Receipt";
            readonly label: {
                readonly en: "Quote sent";
                readonly ar: "تم إرسال عرض السعر";
                readonly de: "Angebot gesendet";
                readonly fr: "Devis envoyé";
                readonly it: "Preventivo inviato";
            };
            readonly next: readonly ["awaiting_payment", "rejected", "expired"];
            readonly customerLabel: {
                readonly en: "Quote to review";
                readonly ar: "عرض سعر للمراجعة";
                readonly de: "Angebot zu prüfen";
                readonly fr: "Devis à consulter";
                readonly it: "Preventivo da valutare";
            };
        };
        readonly awaiting_payment: {
            readonly tone: "warning";
            readonly icon: "CreditCard";
            readonly label: {
                readonly en: "Awaiting payment";
                readonly ar: "بانتظار الدفع";
                readonly de: "Zahlung ausstehend";
                readonly fr: "En attente de paiement";
                readonly it: "In attesa di pagamento";
            };
            readonly next: readonly ["in_progress", "cancelled"];
            readonly customerLabel: {
                readonly en: "Payment due";
                readonly ar: "الدفع مستحق";
                readonly de: "Zahlung fällig";
                readonly fr: "Paiement dû";
                readonly it: "Pagamento dovuto";
            };
        };
        readonly in_progress: {
            readonly tone: "info";
            readonly icon: "CircleHalf";
            readonly label: {
                readonly en: "In progress";
                readonly ar: "قيد التنفيذ";
                readonly de: "In Bearbeitung";
                readonly fr: "En cours";
                readonly it: "In corso";
            };
            readonly next: readonly ["customer_review", "on_hold"];
        };
        readonly customer_review: {
            readonly tone: "warning";
            readonly icon: "MagnifyingGlass";
            readonly label: {
                readonly en: "With the customer";
                readonly ar: "لدى العميل";
                readonly de: "Beim Kunden";
                readonly fr: "Chez le client";
                readonly it: "Presso il cliente";
            };
            readonly next: readonly ["in_progress (revision)", "completed"];
            readonly customerLabel: {
                readonly en: "Ready for your review";
                readonly ar: "جاهز لمراجعتك";
                readonly de: "Bereit zur Prüfung";
                readonly fr: "Prêt pour votre validation";
                readonly it: "Pronto per la tua revisione";
            };
        };
        readonly on_hold: {
            readonly tone: "warning";
            readonly icon: "PauseCircle";
            readonly label: {
                readonly en: "On hold";
                readonly ar: "معلّق";
                readonly de: "Pausiert";
                readonly fr: "En pause";
                readonly it: "In pausa";
            };
            readonly next: readonly ["in_progress", "cancelled"];
            readonly customerLabel: {
                readonly en: "Waiting for your input";
                readonly ar: "بانتظار مدخلاتك";
                readonly de: "Wartet auf Ihre Eingabe";
                readonly fr: "En attente de votre retour";
                readonly it: "In attesa del tuo riscontro";
            };
        };
        readonly completed: {
            readonly tone: "success";
            readonly icon: "CheckCircle";
            readonly label: {
                readonly en: "Completed";
                readonly ar: "مكتمل";
                readonly de: "Abgeschlossen";
                readonly fr: "Terminée";
                readonly it: "Completata";
            };
            readonly next: readonly [];
        };
        readonly rejected: {
            readonly tone: "neutral";
            readonly icon: "XCircle";
            readonly label: {
                readonly en: "Rejected";
                readonly ar: "مرفوض";
                readonly de: "Abgelehnt";
                readonly fr: "Refusée";
                readonly it: "Rifiutata";
            };
            readonly next: readonly ["quoted (new quote)"];
        };
        readonly expired: {
            readonly tone: "neutral";
            readonly icon: "HourglassSimpleLow";
            readonly label: {
                readonly en: "Expired";
                readonly ar: "منتهي الصلاحية";
                readonly de: "Abgelaufen";
                readonly fr: "Expirée";
                readonly it: "Scaduta";
            };
            readonly next: readonly ["quoted (new quote)"];
        };
        readonly cancelled: {
            readonly tone: "neutral";
            readonly icon: "MinusCircle";
            readonly label: {
                readonly en: "Cancelled";
                readonly ar: "ملغى";
                readonly de: "Storniert";
                readonly fr: "Annulée";
                readonly it: "Annullata";
            };
            readonly next: readonly [];
        };
    };
    readonly support_ticket: {
        readonly open: {
            readonly tone: "info";
            readonly icon: "Circle";
            readonly label: {
                readonly en: "Open";
                readonly ar: "مفتوحة";
                readonly de: "Offen";
                readonly fr: "Ouvert";
                readonly it: "Aperto";
            };
            readonly next: readonly ["in_progress"];
        };
        readonly in_progress: {
            readonly tone: "info";
            readonly icon: "CircleHalf";
            readonly label: {
                readonly en: "In progress";
                readonly ar: "قيد المعالجة";
                readonly de: "In Bearbeitung";
                readonly fr: "En cours";
                readonly it: "In lavorazione";
            };
            readonly next: readonly ["awaiting_reply", "resolved"];
        };
        readonly awaiting_reply: {
            readonly tone: "warning";
            readonly icon: "ChatCircleDots";
            readonly label: {
                readonly en: "Waiting for customer";
                readonly ar: "بانتظار رد العميل";
                readonly de: "Wartet auf Kunde";
                readonly fr: "En attente du client";
                readonly it: "In attesa del cliente";
            };
            readonly next: readonly ["in_progress", "closed"];
            readonly customerLabel: {
                readonly en: "Waiting for you";
                readonly ar: "بانتظار ردك";
                readonly de: "Wartet auf Sie";
                readonly fr: "En attente de votre réponse";
                readonly it: "In attesa della tua risposta";
            };
        };
        readonly resolved: {
            readonly tone: "success";
            readonly icon: "CheckCircle";
            readonly label: {
                readonly en: "Resolved";
                readonly ar: "تم الحل";
                readonly de: "Gelöst";
                readonly fr: "Résolu";
                readonly it: "Risolto";
            };
            readonly next: readonly ["in_progress", "closed"];
        };
        readonly closed: {
            readonly tone: "neutral";
            readonly icon: "Check";
            readonly label: {
                readonly en: "Closed";
                readonly ar: "مغلقة";
                readonly de: "Geschlossen";
                readonly fr: "Fermé";
                readonly it: "Chiuso";
            };
            readonly next: readonly [];
        };
    };
    readonly banner: {
        readonly suspended: {
            readonly tone: "danger";
            readonly icon: "Prohibit";
            readonly label: {
                readonly en: "Workspace suspended";
                readonly ar: "مساحة العمل موقوفة";
                readonly de: "Arbeitsbereich gesperrt";
                readonly fr: "Espace de travail suspendu";
                readonly it: "Spazio di lavoro sospeso";
            };
            readonly next: readonly [];
        };
        readonly read_only: {
            readonly tone: "danger";
            readonly icon: "WarningCircle";
            readonly label: {
                readonly en: "Tools are read-only";
                readonly ar: "الأدوات للقراءة فقط";
                readonly de: "Tools nur zur Ansicht";
                readonly fr: "Outils en lecture seule";
                readonly it: "Strumenti in sola lettura";
            };
            readonly next: readonly [];
        };
        readonly payment_failed: {
            readonly tone: "danger";
            readonly icon: "CreditCard";
            readonly label: {
                readonly en: "Payment failed";
                readonly ar: "فشل الدفع";
                readonly de: "Zahlung fehlgeschlagen";
                readonly fr: "Échec du paiement";
                readonly it: "Pagamento non riuscito";
            };
            readonly next: readonly [];
        };
        readonly trial_ending: {
            readonly tone: "info";
            readonly icon: "Timer";
            readonly label: {
                readonly en: "Trial ends soon";
                readonly ar: "تنتهي التجربة قريبًا";
                readonly de: "Testphase endet bald";
                readonly fr: "L'essai se termine bientôt";
                readonly it: "La prova termina a breve";
            };
            readonly next: readonly [];
        };
        readonly beta_billing: {
            readonly tone: "warning";
            readonly icon: "Flask";
            readonly label: {
                readonly en: "Beta billing starts";
                readonly ar: "بدء فوترة الإصدار التجريبي";
                readonly de: "Abrechnung der Beta beginnt";
                readonly fr: "Début de la facturation de la bêta";
                readonly it: "Inizia la fatturazione della beta";
            };
            readonly next: readonly [];
        };
        readonly price_change: {
            readonly tone: "warning";
            readonly icon: "Tag";
            readonly label: {
                readonly en: "Price change";
                readonly ar: "تغيير في السعر";
                readonly de: "Preisänderung";
                readonly fr: "Changement de prix";
                readonly it: "Variazione di prezzo";
            };
            readonly next: readonly [];
        };
        readonly downgrade_scheduled: {
            readonly tone: "neutral";
            readonly icon: "ArrowFatLinesDown";
            readonly label: {
                readonly en: "Downgrade scheduled";
                readonly ar: "تخفيض مجدول";
                readonly de: "Herabstufung geplant";
                readonly fr: "Rétrogradation prévue";
                readonly it: "Downgrade programmato";
            };
            readonly next: readonly [];
        };
        readonly staff_viewing: {
            readonly tone: "brand";
            readonly icon: "Eye";
            readonly label: {
                readonly en: "Viewing as customer";
                readonly ar: "عرض بصفة العميل";
                readonly de: "Ansicht als Kunde";
                readonly fr: "Vue client";
                readonly it: "Vista come cliente";
            };
            readonly next: readonly [];
        };
    };
    readonly cms_revision: {
        readonly draft: {
            readonly tone: "neutral";
            readonly icon: "PencilSimple";
            readonly label: {
                readonly en: "Draft";
                readonly ar: "مسودة";
                readonly de: "Entwurf";
                readonly fr: "Brouillon";
                readonly it: "Bozza";
            };
            readonly next: readonly ["in_review"];
        };
        readonly in_review: {
            readonly tone: "info";
            readonly icon: "MagnifyingGlass";
            readonly label: {
                readonly en: "In review";
                readonly ar: "قيد المراجعة";
                readonly de: "In Prüfung";
                readonly fr: "En relecture";
                readonly it: "In revisione";
            };
            readonly next: readonly ["approved", "draft (changes requested)"];
        };
        readonly approved: {
            readonly tone: "success";
            readonly icon: "SealCheck";
            readonly label: {
                readonly en: "Approved";
                readonly ar: "معتمد";
                readonly de: "Freigegeben";
                readonly fr: "Approuvé";
                readonly it: "Approvato";
            };
            readonly next: readonly ["scheduled", "published"];
        };
        readonly scheduled: {
            readonly tone: "info";
            readonly icon: "CalendarCheck";
            readonly label: {
                readonly en: "Scheduled";
                readonly ar: "مجدول";
                readonly de: "Geplant";
                readonly fr: "Planifié";
                readonly it: "Programmato";
            };
            readonly next: readonly ["published", "approved (unschedule)"];
        };
        readonly published: {
            readonly tone: "success";
            readonly icon: "Globe";
            readonly label: {
                readonly en: "Published";
                readonly ar: "منشور";
                readonly de: "Veröffentlicht";
                readonly fr: "Publié";
                readonly it: "Pubblicato";
            };
            readonly next: readonly [];
        };
    };
    readonly cms_visibility: {
        readonly unpublished: {
            readonly tone: "neutral";
            readonly icon: "EyeSlash";
            readonly label: {
                readonly en: "Not on the site";
                readonly ar: "غير منشور";
                readonly de: "Nicht online";
                readonly fr: "Hors ligne";
                readonly it: "Non pubblicato";
            };
            readonly next: readonly ["live"];
        };
        readonly live: {
            readonly tone: "success";
            readonly icon: "Globe";
            readonly label: {
                readonly en: "Live";
                readonly ar: "منشور على الموقع";
                readonly de: "Online";
                readonly fr: "En ligne";
                readonly it: "Online";
            };
            readonly next: readonly ["unpublished", "archived"];
        };
        readonly archived: {
            readonly tone: "neutral";
            readonly icon: "Archive";
            readonly label: {
                readonly en: "Archived";
                readonly ar: "مؤرشف";
                readonly de: "Archiviert";
                readonly fr: "Archivé";
                readonly it: "Archiviato";
            };
            readonly next: readonly ["unpublished"];
        };
    };
    readonly translation: {
        readonly not_started: {
            readonly tone: "neutral";
            readonly icon: "Circle";
            readonly label: {
                readonly en: "Not started";
                readonly ar: "لم تبدأ";
                readonly de: "Nicht begonnen";
                readonly fr: "Non commencée";
                readonly it: "Non iniziata";
            };
            readonly next: readonly ["in_progress"];
        };
        readonly in_progress: {
            readonly tone: "info";
            readonly icon: "CircleHalf";
            readonly label: {
                readonly en: "In progress";
                readonly ar: "قيد الترجمة";
                readonly de: "In Arbeit";
                readonly fr: "En cours";
                readonly it: "In corso";
            };
            readonly next: readonly ["needs_review"];
        };
        readonly needs_review: {
            readonly tone: "warning";
            readonly icon: "MagnifyingGlass";
            readonly label: {
                readonly en: "Needs review";
                readonly ar: "بحاجة إلى مراجعة";
                readonly de: "Prüfung nötig";
                readonly fr: "À relire";
                readonly it: "Da revisionare";
            };
            readonly next: readonly ["ready", "in_progress"];
        };
        readonly ready: {
            readonly tone: "success";
            readonly icon: "CheckCircle";
            readonly label: {
                readonly en: "Ready";
                readonly ar: "جاهزة";
                readonly de: "Bereit";
                readonly fr: "Prête";
                readonly it: "Pronta";
            };
            readonly next: readonly ["published"];
        };
        readonly published: {
            readonly tone: "success";
            readonly icon: "Globe";
            readonly label: {
                readonly en: "Published";
                readonly ar: "منشورة";
                readonly de: "Veröffentlicht";
                readonly fr: "Publiée";
                readonly it: "Pubblicata";
            };
            readonly next: readonly ["outdated"];
        };
        readonly outdated: {
            readonly tone: "warning";
            readonly icon: "ArrowsClockwise";
            readonly label: {
                readonly en: "Outdated";
                readonly ar: "تحتاج إلى تحديث";
                readonly de: "Veraltet";
                readonly fr: "Obsolète";
                readonly it: "Da aggiornare";
            };
            readonly next: readonly ["in_progress"];
        };
    };
    readonly lead: {
        readonly new: {
            readonly tone: "info";
            readonly icon: "Circle";
            readonly label: {
                readonly en: "New";
                readonly ar: "جديد";
                readonly de: "Neu";
                readonly fr: "Nouveau";
                readonly it: "Nuovo";
            };
            readonly next: readonly ["contacted", "qualified", "unqualified", "spam", "duplicate"];
        };
        readonly contacted: {
            readonly tone: "info";
            readonly icon: "ChatCircleText";
            readonly label: {
                readonly en: "Contacted";
                readonly ar: "تم التواصل";
                readonly de: "Kontaktiert";
                readonly fr: "Contacté";
                readonly it: "Contattato";
            };
            readonly next: readonly ["qualified", "unqualified", "lost"];
        };
        readonly qualified: {
            readonly tone: "info";
            readonly icon: "SealCheck";
            readonly label: {
                readonly en: "Qualified";
                readonly ar: "مؤهل";
                readonly de: "Qualifiziert";
                readonly fr: "Qualifié";
                readonly it: "Qualificato";
            };
            readonly next: readonly ["quoted", "lost"];
        };
        readonly unqualified: {
            readonly tone: "neutral";
            readonly icon: "MinusCircle";
            readonly label: {
                readonly en: "Not a fit";
                readonly ar: "غير مناسب";
                readonly de: "Nicht passend";
                readonly fr: "Non qualifié";
                readonly it: "Non idoneo";
            };
            readonly next: readonly ["new (reopen)"];
        };
        readonly quoted: {
            readonly tone: "warning";
            readonly icon: "Receipt";
            readonly label: {
                readonly en: "Quote sent";
                readonly ar: "تم إرسال عرض السعر";
                readonly de: "Angebot gesendet";
                readonly fr: "Devis envoyé";
                readonly it: "Preventivo inviato";
            };
            readonly next: readonly ["won", "lost"];
        };
        readonly won: {
            readonly tone: "success";
            readonly icon: "Trophy";
            readonly label: {
                readonly en: "Won";
                readonly ar: "ناجح";
                readonly de: "Gewonnen";
                readonly fr: "Gagné";
                readonly it: "Acquisito";
            };
            readonly next: readonly [];
        };
        readonly lost: {
            readonly tone: "neutral";
            readonly icon: "XCircle";
            readonly label: {
                readonly en: "Lost";
                readonly ar: "غير ناجح";
                readonly de: "Verloren";
                readonly fr: "Perdu";
                readonly it: "Perso";
            };
            readonly next: readonly [];
        };
        readonly spam: {
            readonly tone: "neutral";
            readonly icon: "Prohibit";
            readonly label: {
                readonly en: "Spam";
                readonly ar: "رسالة مزعجة";
                readonly de: "Spam";
                readonly fr: "Spam";
                readonly it: "Spam";
            };
            readonly next: readonly [];
        };
        readonly duplicate: {
            readonly tone: "neutral";
            readonly icon: "Copy";
            readonly label: {
                readonly en: "Duplicate";
                readonly ar: "مكرر";
                readonly de: "Duplikat";
                readonly fr: "Doublon";
                readonly it: "Duplicato";
            };
            readonly next: readonly [];
        };
    };
    readonly roadmap_idea: {
        readonly pending: {
            readonly tone: "warning";
            readonly icon: "Clock";
            readonly label: {
                readonly en: "Pending";
                readonly ar: "بانتظار المراجعة";
                readonly de: "In Prüfung";
                readonly fr: "En attente";
                readonly it: "In attesa";
            };
            readonly next: readonly ["open", "declined", "merged", "hidden"];
        };
        readonly open: {
            readonly tone: "info";
            readonly icon: "Lightbulb";
            readonly label: {
                readonly en: "Open";
                readonly ar: "مفتوحة للتصويت";
                readonly de: "Offen";
                readonly fr: "Ouverte";
                readonly it: "Aperta";
            };
            readonly next: readonly ["planned", "declined", "merged"];
        };
        readonly planned: {
            readonly tone: "info";
            readonly icon: "CalendarBlank";
            readonly label: {
                readonly en: "Planned";
                readonly ar: "مخطط لها";
                readonly de: "Geplant";
                readonly fr: "Prévue";
                readonly it: "Pianificata";
            };
            readonly next: readonly ["in_progress"];
        };
        readonly in_progress: {
            readonly tone: "info";
            readonly icon: "CircleHalf";
            readonly label: {
                readonly en: "In progress";
                readonly ar: "قيد التنفيذ";
                readonly de: "In Arbeit";
                readonly fr: "En cours";
                readonly it: "In corso";
            };
            readonly next: readonly ["shipped"];
        };
        readonly shipped: {
            readonly tone: "success";
            readonly icon: "RocketLaunch";
            readonly label: {
                readonly en: "Shipped";
                readonly ar: "تم الإطلاق";
                readonly de: "Veröffentlicht";
                readonly fr: "Livrée";
                readonly it: "Rilasciata";
            };
            readonly next: readonly [];
        };
        readonly declined: {
            readonly tone: "neutral";
            readonly icon: "XCircle";
            readonly label: {
                readonly en: "Declined";
                readonly ar: "مرفوضة";
                readonly de: "Abgelehnt";
                readonly fr: "Refusée";
                readonly it: "Rifiutata";
            };
            readonly next: readonly [];
        };
        readonly merged: {
            readonly tone: "neutral";
            readonly icon: "GitMerge";
            readonly label: {
                readonly en: "Merged";
                readonly ar: "مدمجة";
                readonly de: "Zusammengeführt";
                readonly fr: "Fusionnée";
                readonly it: "Unita";
            };
            readonly next: readonly [];
        };
        readonly hidden: {
            readonly tone: "neutral";
            readonly icon: "EyeSlash";
            readonly label: {
                readonly en: "Hidden";
                readonly ar: "مخفية";
                readonly de: "Ausgeblendet";
                readonly fr: "Masquée";
                readonly it: "Nascosta";
            };
            readonly next: readonly [];
        };
    };
    readonly share_link: {
        readonly active: {
            readonly tone: "success";
            readonly icon: "Link";
            readonly label: {
                readonly en: "Active";
                readonly ar: "نشط";
                readonly de: "Aktiv";
                readonly fr: "Actif";
                readonly it: "Attivo";
            };
            readonly next: readonly ["expired", "revoked"];
        };
        readonly expired: {
            readonly tone: "neutral";
            readonly icon: "HourglassSimpleLow";
            readonly label: {
                readonly en: "Expired";
                readonly ar: "منتهي الصلاحية";
                readonly de: "Abgelaufen";
                readonly fr: "Expiré";
                readonly it: "Scaduto";
            };
            readonly next: readonly ["active (new expiry)"];
        };
        readonly revoked: {
            readonly tone: "neutral";
            readonly icon: "LinkBreak";
            readonly label: {
                readonly en: "Revoked";
                readonly ar: "ملغى";
                readonly de: "Widerrufen";
                readonly fr: "Révoqué";
                readonly it: "Revocato";
            };
            readonly next: readonly [];
        };
    };
    readonly task: {
        readonly backlog: {
            readonly tone: "neutral";
            readonly icon: "Tray";
            readonly label: {
                readonly en: "Backlog";
                readonly ar: "قائمة الانتظار";
                readonly de: "Backlog";
                readonly fr: "Backlog";
                readonly it: "Backlog";
            };
            readonly next: readonly ["todo"];
        };
        readonly todo: {
            readonly tone: "neutral";
            readonly icon: "Circle";
            readonly label: {
                readonly en: "To do";
                readonly ar: "للتنفيذ";
                readonly de: "Zu erledigen";
                readonly fr: "À faire";
                readonly it: "Da fare";
            };
            readonly next: readonly ["in_progress"];
        };
        readonly in_progress: {
            readonly tone: "info";
            readonly icon: "CircleHalf";
            readonly label: {
                readonly en: "In progress";
                readonly ar: "قيد التنفيذ";
                readonly de: "In Bearbeitung";
                readonly fr: "En cours";
                readonly it: "In corso";
            };
            readonly next: readonly ["in_review", "done"];
        };
        readonly in_review: {
            readonly tone: "warning";
            readonly icon: "MagnifyingGlass";
            readonly label: {
                readonly en: "In review";
                readonly ar: "قيد المراجعة";
                readonly de: "In Prüfung";
                readonly fr: "En revue";
                readonly it: "In revisione";
            };
            readonly next: readonly ["done", "in_progress"];
        };
        readonly done: {
            readonly tone: "success";
            readonly icon: "CheckCircle";
            readonly label: {
                readonly en: "Done";
                readonly ar: "منجزة";
                readonly de: "Erledigt";
                readonly fr: "Terminée";
                readonly it: "Completata";
            };
            readonly next: readonly [];
        };
    };
    readonly leave_request: {
        readonly pending: {
            readonly tone: "warning";
            readonly icon: "Clock";
            readonly label: {
                readonly en: "Pending";
                readonly ar: "قيد الانتظار";
                readonly de: "Ausstehend";
                readonly fr: "En attente";
                readonly it: "In attesa";
            };
            readonly next: readonly ["approved", "rejected", "cancelled"];
        };
        readonly approved: {
            readonly tone: "success";
            readonly icon: "CheckCircle";
            readonly label: {
                readonly en: "Approved";
                readonly ar: "موافق عليها";
                readonly de: "Genehmigt";
                readonly fr: "Approuvée";
                readonly it: "Approvata";
            };
            readonly next: readonly ["cancelled"];
        };
        readonly rejected: {
            readonly tone: "danger";
            readonly icon: "XCircle";
            readonly label: {
                readonly en: "Rejected";
                readonly ar: "مرفوضة";
                readonly de: "Abgelehnt";
                readonly fr: "Refusée";
                readonly it: "Rifiutata";
            };
            readonly next: readonly [];
        };
        readonly cancelled: {
            readonly tone: "neutral";
            readonly icon: "MinusCircle";
            readonly label: {
                readonly en: "Cancelled";
                readonly ar: "ملغاة";
                readonly de: "Zurückgezogen";
                readonly fr: "Annulée";
                readonly it: "Annullata";
            };
            readonly next: readonly [];
        };
    };
};
export type StatusEntity = keyof typeof STATUS_MATRIX;
export type StatusState<E extends StatusEntity> = keyof (typeof STATUS_MATRIX)[E] & string;
//# sourceMappingURL=matrix.d.ts.map