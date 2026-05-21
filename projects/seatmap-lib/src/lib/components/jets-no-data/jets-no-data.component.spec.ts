import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsNoDataComponent } from './jets-no-data.component';

describe('JetsNoDataComponent', () => {
  let fixture: ComponentFixture<JetsNoDataComponent>;
  let component: JetsNoDataComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsNoDataComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsNoDataComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render a non-empty message by default', () => {
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim().length).toBeGreaterThan(0);
  });

  it('should honour the lang input', () => {
    component.lang = 'RU';
    fixture.detectChanges();
    const ru = (fixture.nativeElement as HTMLElement).textContent ?? '';

    component.lang = 'EN';
    fixture.detectChanges();
    const en = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(ru.trim()).not.toBe('');
    expect(en.trim()).not.toBe('');
  });
});
