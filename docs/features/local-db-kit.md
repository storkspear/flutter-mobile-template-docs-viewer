# local_db_kit

**Drift (SQLite ORM) + 마이그레이션 BootStep + 지문 테스트**. 로컬 전용 앱 · 오프라인 우선 앱의 핵심.

---

## 개요

- **Drift**: SQLite 를 Dart ORM 으로 다룸. 타입 안전 쿼리
- **코드 생성**: `build_runner` 로 DAO · 테이블 클래스 자동 생성
- **마이그레이션**: `DbMigrationStep` (BootStep) 이 버전 업 시 자동 실행
- **지문 테스트**: 스키마 변경 자동 감지 (`migration_fingerprint_test.dart`)
- **플랫폼**: sqlite3_flutter_libs 로 Android · iOS · macOS · Windows · Linux 지원

---

## 활성화

```yaml
# app_kits.yaml
kits:
  local_db_kit:
    database_class: AppDatabase
    database_file: lib/database/app_database.dart
```

```dart
// lib/main.dart
await AppKits.install([
  LocalDbKit(database: () => AppDatabase()),  // ← factory 함수 (lazy 초기화)
  // ...
]);
```

> `database` 인자는 **인스턴스가 아닌 팩토리 함수** (`GeneratedDatabase Function()`). BootStep 에서 한 번만 호출해 캐싱.

---

## 제공 기능

| 항목 | 설명 |
|------|------|
| `LocalDbKit` | `AppKit` 구현. `DbMigrationStep` BootStep 기여 |
| `DbMigrationStep` | 부팅 시 스키마 버전 체크 · 마이그레이션 |
| `lazyNativeDatabase` | SQLite 파일 lazy 초기화 헬퍼 |
| (파생 레포) `AppDatabase` | Drift 생성 DAO · 테이블 |

---

## 파생 레포 워크플로우

### 1. 테이블 정의

```dart
// lib/database/tables/expenses.dart
import 'package:drift/drift.dart';

class Expenses extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get title => text().withLength(min: 1, max: 100)();
  IntColumn get amount => integer()();
  DateTimeColumn get expenseDate => dateTime()();
  DateTimeColumn get createdAt => dateTime().clientDefault(() => DateTime.now())();
}
```

### 2. 데이터베이스 클래스

```dart
// lib/database/app_database.dart
@DriftDatabase(tables: [Expenses])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(lazyNativeDatabase('app.sqlite'));

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) => m.createAll(),
    onUpgrade: (m, from, to) async {
      if (from < 2) {
        await m.addColumn(expenses, expenses.category);
      }
    },
  );

  Future<List<Expense>> allExpenses() => select(expenses).get();
  Future<int> insertExpense(ExpensesCompanion data) => into(expenses).insert(data);
}
```

### 3. 코드 생성

```bash
dart run build_runner build --delete-conflicting-outputs
```

생성 파일: `app_database.g.dart`

### 4. Provider 등록

```dart
// lib/common/providers.dart (파생 레포에서 확장)
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});
```

### 5. Repository 에서 사용

```dart
class ExpenseRepository {
  final AppDatabase _db;
  ExpenseRepository(this._db);

  Future<List<Expense>> list() => _db.allExpenses();

  Future<int> add(String title, int amount, DateTime date) {
    return _db.insertExpense(ExpensesCompanion.insert(
      title: title,
      amount: amount,
      expenseDate: date,
    ));
  }
}
```

---

## 마이그레이션 지문 테스트

스키마 변경 시 **지문 테스트가 자동 감지**. CI 에서 깨지면 의도적 변경인지 확인 후 갱신.

```bash
# 지문 갱신
dart run test:test test/migration_fingerprint/ -u
```

> ⚠️ 스키마 변경 시 `schemaVersion` 올리고 `onUpgrade` 작성 + 지문 갱신 필수. 이 중 하나라도 빼먹으면 앱 크래시.

---

## 파생 레포 체크리스트

- [ ] `pubspec.yaml` 에 `drift_dev` · `build_runner` dev_dependencies
- [ ] `lib/database/app_database.dart` 작성 (DAO · 테이블)
- [ ] `dart run build_runner build` 실행
- [ ] `lib/main.dart` 에서 `LocalDbKit(database: () => AppDatabase())` 전달 (factory 함수)
- [ ] 초기 실행 시 DB 파일 생성 확인 (Android: Documents, iOS: Application Support)
- [ ] 테이블 변경 시: `schemaVersion` 올림 + `onUpgrade` 작성 + 지문 갱신

---

## Code References

- [`lib/kits/local_db_kit/local_db_kit.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/local_db_kit/local_db_kit.dart)
- [`lib/kits/local_db_kit/db_migration_step.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/local_db_kit/db_migration_step.dart)
- [`lib/kits/local_db_kit/db_paths.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/local_db_kit/db_paths.dart) — `lazyNativeDatabase()` 헬퍼 정의
- [`lib/kits/local_db_kit/db_providers.dart`](https://github.com/storkspear/template-flutter/blob/main/lib/kits/local_db_kit/db_providers.dart) — `databaseProvider` 정의

---

## 관련 문서

- [Drift 공식 문서](https://drift.simonbinder.eu/)
- [`Testing Conventions`](../testing/testing-strategy.md) — 지문 테스트 상세
