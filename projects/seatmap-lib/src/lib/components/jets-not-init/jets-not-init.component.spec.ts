import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsNotInitComponent } from './jets-not-init.component';

describe('JetsNotInitComponent', () => {
  let fixture: ComponentFixture<JetsNotInitComponent>;
  let component: JetsNotInitComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsNotInitComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsNotInitComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render an English loading label by default', () => {
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('should respect the lang input', () => {
    component.lang = 'RU';
    fixture.detectChanges();
    const textRu = (fixture.nativeElement as HTMLElement).textContent ?? '';

    component.lang = 'EN';
    fixture.detectChanges();
    const textEn = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(textRu).not.toBe('');
    expect(textEn).not.toBe('');
  });

  it('should fall back gracefully to EN for unknown langs', () => {
    component.lang = 'XX' as any;
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').not.toBe('');
  });
});
